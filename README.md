# SSSynthesiser.js
Web Audio API synthesiser. Pure HTML5 implementation.
Compatible with desktop and mobile Chrome/Opera/Firefox/Safari/Edge.
## Examples
* [simple example](http://molgav.nn.ru/x/example.html)
* [FX example](http://molgav.nn.ru/x/effects.html)
* [WebGL example](http://molgav.nn.ru/babylonsynth/)
* [Song library](http://molgav.nn.ru/liblist.php)
* [Molgav](http://molgav.nn.ru/rtfm/index.html) - Web Audio Musical Step Sequencer for melodies exchange

## Using
Add link to your page:
```HTML
<script src="SSSynthesiser.js"></script>
```
Download song data and initialize engine:
```javascript
var sssynthesiser = null;
var xmlHttpRequest = new XMLHttpRequest();
xmlHttpRequest.open('GET', "http://molgav.nn.ru/x/sviridovtimeforward.molgav", true);
xmlHttpRequest.onload = function () {
	var o = JSON.parse(xmlHttpRequest.response);
	sssynthesiser = new SSSynthesiser(o);
};
xmlHttpRequest.send();
```
Start play:
```javascript
sssynthesiser.startPlaySong()
```
Stop play:
```javascript
sssynthesiser.stopPlaySong();
```
Change instruments's properties:
```javascript
sssynthesiser.findSampleBySubPath("drums/000/Chaos_128/061_046-046_60_-4600.0_8-34789_32000").volume = 0.25;
```
Control play order:
```javascript
sssynthesiser.moveToNextPosition = function(){
	if((sssynthesiser.currentX == 3 && sssynthesiser.currentY == 2) || sssynthesiser.currentY < 1 || sssynthesiser.currentY >2 ){
		sssynthesiser.currentX = 0;
		sssynthesiser.currentY = 1;
		sssynthesiser.currentPosition = sssynthesiser.findPosition(sssynthesiser.currentX, sssynthesiser.currentY);
		return;
	}
	else{
		sssynthesiser.findAndMoveToNextPosition();
	}
};
```
Play a instrument:
```javascript
sssynthesiser.playKey(sssynthesiser.findSampleBySubPath(s),1000,45);
```
Play a drum:
```javascript
sssynthesiser.playSample(sssynthesiser.findSampleBySubPath(s),2000);
```
Play a chord:
```javascript
sssynthesiser.playChord(sssynthesiser.findSampleBySubPath(s),2000,[48,52,55,60,64]);
```

## Song data format
Song similar to tracker modules. It should include patterns, positions, binary samples etc. See [example](http://molgav.nn.ru/x/sviridovtimeforward.molgav) of song.

You can use [Molgav](http://molgav.nn.ru/) to create song data or convert your MIDI-files.
* open [Molgav](http://molgav.nn.ru/)
* select menu item 'import from.mid'
* edit song
* select menu item 'save song as'

