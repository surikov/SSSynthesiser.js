if (typeof console == "undefined") {
	window.console = {
		log : function () {
			//
		}
	};
}
function SSSynthesiser(songData) {
	this.version = "1.02";
	console.log("SSSynthesiser", this.version);
	this.song = songData;
	this.buffer16size = this.mixSampleRate * (60.0 / 4.0) / this.song.tempo; ;
	this.currentPosition = this.findPosition(0, 0);
	this.mixSamples = [];
	if (!this.audioContext) {
		try {
			var f = window.AudioContext || window.webkitAudioContext;
			this.audioContext = new f();
		} catch (e) {
			console.log(e);
		}
	}
	this.initialized = true;
	return this;
}
SSSynthesiser.prototype.decayRatio = 0.9995;
SSSynthesiser.prototype.stopped = true;
SSSynthesiser.prototype.scriptProcessorNode = null;
SSSynthesiser.prototype.currentX = 0;
SSSynthesiser.prototype.currentY = 0;
SSSynthesiser.prototype.mix16Counter = 0;
SSSynthesiser.prototype.currentBar = 0;
SSSynthesiser.prototype.mixSampleRate = 44100;
SSSynthesiser.prototype.buffer16size = 0;
SSSynthesiser.prototype.minSampling = 3000 * 4;
SSSynthesiser.prototype.maxSampling = 192000;
SSSynthesiser.prototype.currentPosition = null;
SSSynthesiser.prototype.mixSamples = [];
SSSynthesiser.prototype.audioContext = null;
SSSynthesiser.prototype.stopPlaySong = function () {
	this.stopped = true;
};
SSSynthesiser.prototype.createAudioBufferSourceNode = function (sample) {
	var signed = sample.signed;
	var findx = Math.floor(sample.basePitch);
	var sampleFrequency = this.soundFrequencies[findx];
	var startFrequency = this.calculateFrequency(sample.basePitch, sample.basePitch, sample.correction);
	var rate = (startFrequency / sampleFrequency) * sample.sampleRate;
	var step = 1;
	for (var i = 0; i < 5; i++) {
		if (rate > this.maxSampling) {
			rate = rate / 2;
			step = step * 2;
		}
	}
	for (var i = 0; i < 5; i++) {
		if (rate < this.minSampling) {
			rate = rate * 2;
			step = step / 2;
		}
	}
	var audioBuffer = this.audioContext.createBuffer(1, signed.length, rate); //[3000, 192000]
	var float32Array = audioBuffer.getChannelData(0);
	var len32 = float32Array.length;
	var s = 0;
	for (var i = 0; i < len32; i++) {
		if (s < signed.length) {
			float32Array[i] = 0.5 * sample.volume * signed[Math.floor(s)] / 128.0;
			s = s + step;
		} else {
			break;
		}
	}
	var audioBufferSourceNode = this.audioContext.createBufferSource();
	audioBufferSourceNode.buffer = audioBuffer;
	audioBufferSourceNode.connect(this.audioContext.destination);
	return audioBufferSourceNode;
}
SSSynthesiser.prototype.createAudioBufferSourceNodeByKey = function (sample, key) {
	var signed = sample.signed;
	var findx = Math.floor(sample.basePitch);
	var sampleFrequency = this.soundFrequencies[findx];
	var startIdx = key + sample.basePitch + sample.correction / 100.0;
	var startFrequency = this.soundFrequencies[Math.floor(startIdx)];
	var rate = (startFrequency / sampleFrequency) * sample.sampleRate;
	var step = 1;
	for (var i = 0; i < 5; i++) {
		if (rate > this.maxSampling) {
			rate = rate / 2;
			step = step * 2;
		}
	}
	for (var i = 0; i < 5; i++) {
		if (rate < this.minSampling) {
			rate = rate * 2;
			step = step / 2;
		}
	}
	var audioBuffer = this.audioContext.createBuffer(1, signed.length, rate); //[3000, 192000]
	var float32Array = audioBuffer.getChannelData(0);
	var len32 = float32Array.length;
	var s = 0;
	for (var i = 0; i < len32; i++) {
		if (s < signed.length) {
			float32Array[i] = 0.5 * sample.volume * signed[Math.floor(s)] / 128.0;
			s = s + step;
		} else {
			break;
		}
	}
	var audioBufferSourceNode = this.audioContext.createBufferSource();
	audioBufferSourceNode.buffer = audioBuffer;
	if (sample.loopStart > 10 && sample.loopEnd <= len32) {
		var fre = len32 / rate;
		var st = (fre * sample.loopStart) / len32;
		var en = (fre * sample.loopEnd) / len32;
		audioBufferSourceNode.loop = true;
		audioBufferSourceNode.loopStart = st;
		audioBufferSourceNode.loopEnd = en;
	}
	audioBufferSourceNode.connect(this.audioContext.destination);
	return audioBufferSourceNode;
}
SSSynthesiser.prototype.startPlaySong = function () {
	if (!this.stopped) {
		return;
	}
	this.stopped = false;
	this.removeUnusedSamples();
	this.addNextSamples();
	this.scriptRatio = this.audioContext.sampleRate / this.mixSampleRate; //48000/22050~2
	this.scriptProcessorNode = this.audioContext.createScriptProcessor(1024 * 16, 1, 1);
	var me = this;
	this.scriptProcessorNode.onaudioprocess = function (audioProcessEvent) {
		if (me.stopped) {
			try {
				me.scriptProcessorNode.onaudioprocess = null;
				me.scriptProcessorNode.disconnect(0);
				me.scriptProcessorNode = null;
			} catch (e) {
				console.log(e);
			}
		} else {
			var output = audioProcessEvent.outputBuffer.getChannelData(0);
			var signed = me.mixNext(output.length / me.scriptRatio);
			for (var i = 0; i < output.length; i++) {
				output[i] = signed[~~(i / me.scriptRatio)] / 128;
			}
		}
	};
	this.scriptProcessorNode.connect(this.audioContext.destination);
};
SSSynthesiser.prototype.mixNext = function (size) {
	var signed = [];
	for (var i = 0; i < size; i++) {
		var volume = 0.5 * this.calculateMixBar(this);
		signed.push(volume);
		if (this.moveNext()) {
			this.removeUnusedSamples(this);
			this.addNextSamples(this);
		}
	}
	return signed;
};
SSSynthesiser.prototype.addNextSamples = function () {
	if (this.currentPosition != null) {
		for (var r = 0; r < this.currentPosition.riffIds.length; r++) {
			var songRiff = this.findRiffById(this.currentPosition.riffIds[r]);
			var chord = songRiff.beat[this.mix16Counter];
			if (chord != null) {
				for (var i = 0; i < chord.length; i++) {
					var songRiffBeatPoint = chord[i];
					var songSample = this.findSampleById(songRiffBeatPoint.sampleId);
					this.addMixDrum(songSample);
				}
			}
			for (var t = 0; t < songRiff.tunes.length; t++) {
				var songRiffTune = songRiff.tunes[t];
				var chord = songRiffTune.steps[this.mix16Counter];
				if (chord != null) {
					for (var i = 0; i < chord.length; i++) {
						var songRiffTunePoint = chord[i];
						var songSample = this.findSampleById(songRiffTune.sampleId);
						this.addMixInstrument(songSample, songRiffTunePoint);
					}
				}
			}
		}
	}
};
SSSynthesiser.prototype.removeUnusedSamples = function () {
	var done = false;
	while (!done) {
		done = true;
		for (var i = 0; i < this.mixSamples.length; i++) {
			var mixSample = this.mixSamples[i];
			if (mixSample.unused) {
				this.mixSamples.splice(i, 1);
				done = false;
				break;
			}
		}
	}
};
SSSynthesiser.prototype.calculateMixBar = function () {
	var volume = 0;
	for (var i = 0; i < this.mixSamples.length; i++) {
		var mixSample = this.mixSamples[i];
		if (!mixSample.unused) {
			if (mixSample.isDrum) {
				volume = volume + this.calculateMixBarDrum(mixSample);
			} else {
				volume = volume + this.calculateMixBarInstrument(mixSample);
			}

		}
	}
	return volume;
};
SSSynthesiser.prototype.calculateMixBarDrum = function (mixSample) {
	var volume = 0;
	if (mixSample.currentIndex < mixSample.signed.length) {
		volume = mixSample.volume * mixSample.signed[~~mixSample.currentIndex];
		mixSample.currentIndex = mixSample.currentIndex + mixSample.stepDelta;
	} else {
		mixSample.unused = true;
	}
	return volume;
};
SSSynthesiser.prototype.calculateMixBarInstrument = function (mixSample) {
	var volume = 0;
	if (mixSample.currentIndex < mixSample.signed.length && mixSample.currentIndex > -1) {
		volume = mixSample.volume * mixSample.signed[~~mixSample.currentIndex];
		this.adjustMixBarInstrumentIndex(mixSample);
		this.adjustMixBarInstrumentLoop(mixSample);
		this.adjustMixBarInstrumentDecay(mixSample);
	} else {
		mixSample.unused = true;
	}
	return volume;
};
SSSynthesiser.prototype.adjustMixBarInstrumentIndex = function (mixSample) {
	mixSample.currentIndex = mixSample.currentIndex + mixSample.stepDelta;
	mixSample.stepDelta = mixSample.stepDelta + mixSample.stepShift;
	mixSample.lengthIndex++;
};
SSSynthesiser.prototype.adjustMixBarInstrumentDecay = function (mixSample) {
	if (mixSample.lengthIndex > mixSample.noteLength) {
		if (mixSample.lengthIndex > mixSample.soundLength) {
			mixSample.unused = true;
		} else {
			mixSample.volume = mixSample.volume * this.decayRatio;
		}
	}
};
SSSynthesiser.prototype.adjustMixBarInstrumentLoop = function (mixSample) {
	if (mixSample.loopEnd > 0) {
		if (mixSample.currentIndex >= mixSample.loopEnd) {
			mixSample.currentIndex = mixSample.currentIndex - (mixSample.loopEnd - mixSample.loopStart);
		}
	}
};
SSSynthesiser.prototype.moveNext = function (song) {
	var isJump = false;
	this.currentBar++;
	if (this.currentBar >= this.buffer16size) {
		this.currentBar = 0;
		this.moveToNextSixteenth();
		var meter = this.song.meter;
		if (this.currentPosition != null) {
			if (this.currentPosition.length > 0) {
				meter = this.currentPosition.length;
			}
		}
		if (this.mix16Counter >= meter) {
			this.mix16Counter = 0;
			this.moveToNextPosition();
		}
		isJump = true;
	}
	return isJump;
};
SSSynthesiser.prototype.existsDownPosition = function (y) {
	for (var i = 0; i < this.song.positions.length; i++) {
		if (this.song.positions[i].top > y) {
			return true;
		}
	}
	return false;
};
SSSynthesiser.prototype.existsRightPosition = function (x, y) {
	for (var i = 0; i < this.song.positions.length; i++) {
		if (this.song.positions[i].left > x && this.song.positions[i].top == y) {
			return true;
		}
	}
	return false;
};
SSSynthesiser.prototype.moveToNextSixteenth = function () {
	this.mix16Counter++;
	//console.log("onJumpSixteenth",this.mix16Counter);
};
SSSynthesiser.prototype.moveToNextPosition = function () {
	this.findAndMoveToNextPosition();
};
SSSynthesiser.prototype.findAndMoveToNextPosition = function () {
	if (this.existsRightPosition(this.currentX, this.currentY)) {
		this.currentX++;
	} else {
		if (this.existsDownPosition(this.currentY)) {
			this.currentX = 0;
			this.currentY++;
		} else {
			this.currentX = 0;
			this.currentY = 0;
		}
	}
	this.currentPosition = this.findPosition(this.currentX, this.currentY);
	//console.log("moveToNextPosition", this.currentX, this.currentY);
};

SSSynthesiser.prototype.findPosition = function (x, y) {
	for (var i = 0; i < this.song.positions.length; i++) {
		if (this.song.positions[i].left == x && this.song.positions[i].top == y) {
			return this.song.positions[i];
		}
	}
	return null;
};
SSSynthesiser.prototype.findSampleById = function (id) {
	for (var i = 0; i < this.song.samples.length; i++) {
		if (this.song.samples[i].id == id) {
			return this.song.samples[i];
		}
	}
	return null;
};
SSSynthesiser.prototype.findSampleBySubPath = function (subPath) {
	for (var i = 0; i < this.song.samples.length; i++) {
		if (this.song.samples[i].path.indexOf(subPath) >= 0) {
			return this.song.samples[i];
		}
	}
	return null;
};
SSSynthesiser.prototype.findRiffById = function (id) {
	for (var i = 0; i < this.song.riffs.length; i++) {
		if (this.song.riffs[i].id == id) {
			return this.song.riffs[i];
		}
	}
	return null;
};
SSSynthesiser.prototype.addMixInstrument = function (sample, songRiffTunePoint) {
	var mixSample = new this.SSSample();
	var sampleFrequency = 0.25 * this.soundFrequencies[Math.floor(sample.basePitch)];
	var startFrequency = this.calculateFrequency(songRiffTunePoint.pitch, sample.basePitch, sample.correction);
	var endFrequency = this.calculateFrequency(songRiffTunePoint.pitch + songRiffTunePoint.shift, sample.basePitch, sample.correction);
	var ringLength = this.buffer16size * (songRiffTunePoint.length + 0);
	var endDelta = (endFrequency / sampleFrequency) * (sample.sampleRate / this.mixSampleRate);
	mixSample.noteLength = ringLength;
	mixSample.soundLength = this.buffer16size * (songRiffTunePoint.length + 4);
	mixSample.stepDelta = (startFrequency / sampleFrequency) * (sample.sampleRate / this.mixSampleRate);
	mixSample.stepShift = (endDelta - mixSample.stepDelta) / ringLength;
	mixSample.loopEnd = sample.loopEnd;
	mixSample.loopStart = sample.loopStart;
	mixSample.signed = sample.signed;
	if (mixSample.loopEnd > mixSample.signed.length) {
		mixSample.loopEnd = Math.floor(mixSample.loopEnd / 2);
		if (mixSample.loopEnd < mixSample.loopStart) {
			mixSample.loopStart = Math.floor(mixSample.loopStart / 2);
		}
	}
	mixSample.isDrum = false;
	mixSample.volume = sample.volume;
	this.mixSamples[this.mixSamples.length] = mixSample;
};
SSSynthesiser.prototype.addMixDrum = function (sample) {
	var mixSample = new this.SSSample();
	var sampleFrequency = this.soundFrequencies[Math.floor(sample.basePitch)];
	var startFrequency = this.calculateFrequency(sample.basePitch, sample.basePitch, sample.correction);
	mixSample.stepDelta = (startFrequency / sampleFrequency) * (sample.sampleRate / this.mixSampleRate);
	mixSample.isDrum = true;
	mixSample.signed = sample.signed;
	mixSample.volume = sample.volume;
	this.mixSamples[this.mixSamples.length] = mixSample;
};
SSSynthesiser.prototype.calculateFrequency = function (pitch, base, correction) {
	var shifted = pitch + base + correction / 100.0;
	var f = this.soundFrequencies[Math.floor(shifted)] * 0.25;
	return f;
};
SSSynthesiser.prototype.rewind = function () {
	this.currentPosition = this.findPosition(0, 0);
	this.currentX = 0;
	this.currentY = 0;
	this.currentBar = 0;
	this.mix16Counter = 0;
};
SSSynthesiser.prototype.SSSample = function () {
	this.stepDelta = 0;
	this.signed = null;
	this.currentIndex = 0;
	this.volume = 1.0;
	this.unused = false;
	this.isDrum = false;
	this.stepShift = 0;
	this.loopEnd = 0;
	this.loopStart = 0;
	this.noteLength = 0;
	this.soundLength = 0;
	this.lengthIndex = 0;
	return this;
}
SSSynthesiser.prototype.soundFrequencies = [//
	16.35 // C0
, 17.32 // C#0/Db0
, 18.35 // D0
, 19.45 // D#0/Eb0
, 20.60 // E0
, 21.83 // F0
, 23.12 // F#0/Gb0
, 24.50 // G0
, 25.96 // G#0/Ab0
, 27.50 // A0
, 29.14 // A#0/Bb0
, 30.87 // B0
, 32.70 // C1
, 34.65 // C#1/Db1
, 36.71 // D1
, 38.89 // D#1/Eb1
, 41.20 // E1
, 43.65 // F1
, 46.25 // F#1/Gb1
, 49.00 // G1
, 51.91 // G#1/Ab1
, 55.00 // A1
, 58.27 // A#1/Bb1
, 61.74 // B1
, 65.41 // C2
, 69.30 // C#2/Db2
, 73.42 // D2
, 77.78 // D#2/Eb2
, 82.41 // E2
, 87.31 // F2
, 92.50 // F#2/Gb2
, 98.00 // G2
, 103.83 // G#2/Ab2
, 110.00 // A2
, 116.54 // A#2/Bb2
, 123.47 // B2
, 130.81 // C3
, 138.59 // C#3/Db3
, 146.83 // D3
, 155.56 // D#3/Eb3
, 164.81 // E3
, 174.61 // F3
, 185.00 // F#3/Gb3
, 196.00 // G3
, 207.65 // G#3/Ab3
, 220.00 // A3
, 233.08 // A#3/Bb3
, 246.94 // B3
, 261.63 // C4
, 277.18 // C#4/Db4
, 293.66 // D4
, 311.13 // D#4/Eb4
, 329.63 // E4
, 349.23 // F4
, 369.99 // F#4/Gb4
, 392.00 // G4
, 415.30 // G#4/Ab4
, 440.00 // A4
, 466.16 // A#4/Bb4
, 493.88 // B4
, 523.25 // C5
, 554.37 // C#5/Db5
, 587.33 // D5
, 622.25 // D#5/Eb5
, 659.26 // E5
, 698.46 // F5
, 739.99 // F#5/Gb5
, 783.99 // G5
, 830.61 // G#5/Ab5
, 880.00 // A5
, 932.33 // A#5/Bb5
, 987.77 // B5
, 1046.50 // C6
, 1108.73 // C#6/Db6
, 1174.66 // D6
, 1244.51 // D#6/Eb6
, 1318.51 // E6
, 1396.91 // F6
, 1479.98 // F#6/Gb6
, 1567.98 // G6
, 1661.22 // G#6/Ab6
, 1760.00 // A6
, 1864.66 // A#6/Bb6
, 1975.53 // B6
, 2093.00 // C7
, 2217.46 // C#7/Db7
, 2349.32 // D7
, 2489.02 // D#7/Eb7
, 2637.02 // E7
, 2793.83 // F7
, 2959.96 // F#7/Gb7
, 3135.96 // G7
, 3322.44 // G#7/Ab7
, 3520.00 // A7
, 3729.31 // A#7/Bb7
, 3951.07 // B7
, 2093.00 * 2.0 //
, 2217.46 * 2.0 //
, 2349.32 * 2.0 //
, 2489.02 * 2.0 //
, 2637.02 * 2.0 //
, 2793.83 * 2.0 //
, 2959.96 * 2.0 //
, 3135.96 * 2.0 //
, 3322.44 * 2.0 //
, 3520.00 * 2.0 //
, 3729.31 * 2.0 //
, 3951.07 * 2.0 //
, 2093.00 * 2.0 * 2.0 //
, 2217.46 * 2.0 * 2.0 //
, 2349.32 * 2.0 * 2.0 //
, 2489.02 * 2.0 * 2.0 //
, 2637.02 * 2.0 * 2.0 //
, 2793.83 * 2.0 * 2.0 //
, 2959.96 * 2.0 * 2.0 //
, 3135.96 * 2.0 * 2.0 //
, 3322.44 * 2.0 * 2.0 //
, 3520.00 * 2.0 * 2.0 //
, 3729.31 * 2.0 * 2.0 //
, 3951.07 * 2.0 * 2.0 //
, 2093.00 * 2.0 * 2.0 * 2.0 //
, 2217.46 * 2.0 * 2.0 * 2.0 //
, 2349.32 * 2.0 * 2.0 * 2.0 //
, 2489.02 * 2.0 * 2.0 * 2.0 //
, 2637.02 * 2.0 * 2.0 * 2.0 //
, 2793.83 * 2.0 * 2.0 * 2.0 //
, 2959.96 * 2.0 * 2.0 * 2.0 //
, 3135.96 * 2.0 * 2.0 * 2.0
];
