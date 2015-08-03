# SSSynthesiser.js
Web Audio API synthesiser. Pure HTML5 implementation.
## Examples
* [simple example](http://molgav.nn.ru/x/example.html)
* [WebGL example](http://molgav.nn.ru/babylonsynth/)

## Using
include in HTML
```HTML
<script src="SSSynthesiser.js"></script>
```
init
```javascript
var xmlHttpRequest = new XMLHttpRequest();
			xmlHttpRequest.open('GET', "http://molgav.nn.ru/x/sviridovtimeforward.molgav", true);
			xmlHttpRequest.onload = function () {
				var o = JSON.parse(xmlHttpRequest.response);
				sssynthesiser = new SSSynthesiser(o);
				sssynthesiser.moveToNextPosition = xMoveToNextPosition;
				initialized = true;
				initInfo = document.getElementById("initInfo");
				startInfoLoop();
			};
			xmlHttpRequest.onerror = function (xmlHttpRequestProgressEvent) {
				console.log("error " + xmlHttpRequestProgressEvent);
			};
			xmlHttpRequest.send();
```
