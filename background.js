//Number font from http://www.sum-it.nl/en200351.html

//Config
var apiKey = "5JfdGQtTUgUaUzqmvwAydjMNp";
var refreshDataEveryNSeconds = 30;
var trackForNMinutes = 10;
var minimumNextArrivalMinutes = 0;
var refreshIconEveryNSeconds = 5;
var selectedRoute;
var selectedStop;

//Working Variables
var dataRefreshTimer;
var iconRefreshTimer;
var clearIntervalsTimer = false;
var refreshSecondsOffset;
var nextArrivalInMinutes;
var nextUpdateTime;
var bgSource;
var iconComponentsPendingDraw = 0;

//Main Initiation - called from popup
function startTracking(route, stop, name) {
	selectedRoute = route;
    selectedStop = stop;

	//if bus
	bgSource = 'Bus.png';
	
	//if train, bgsource switch on line and selectedRoute = ""
	//bgSource = 'TrainRed.png';

	clearState();
	chrome.browserAction.setTitle({title: name });
	chrome.storage.sync.get([ 'ctaRefreshDataEveryNSeconds', 'ctaTrackForNMinutes', 'ctaMinimumNextArrivalMinutes' ], function (result) {
		if(result.ctaRefreshDataEveryNSeconds > 0) {
			refreshDataEveryNSeconds = Number(result.ctaRefreshDataEveryNSeconds);
		}
		if(result.ctaTrackForNMinutes > 0) {
			trackForNMinutes = Number(result.ctaTrackForNMinutes);
		}
		if(result.ctaMinimumNextArrivalMinutes > 0) {
			minimumNextArrivalMinutes = Number(result.ctaMinimumNextArrivalMinutes);
		}

		refreshSecondsOffset = 60 - new Date().getSeconds();
		refreshData();
		dataRefreshTimer = setInterval(refreshData, refreshDataEveryNSeconds * 1000);
		iconRefreshTimer = setInterval(drawActiveIcon, refreshIconEveryNSeconds * 1000);
		clearIntervalsTimer = setTimeout(clearState, (trackForNMinutes * 60000) + 5000); //buffer so async callbacks don't overwrite the 'idle' icon
	});
}

//Data Acquisition
function refreshData() {
	var xmlHttp = new XMLHttpRequest();
	xmlHttp.open("GET", "http://ctabustracker.com/bustime/api/v1/getpredictions?key=" + apiKey + "&rt=" + selectedRoute + "&stpid=" + selectedStop, true); // false for synchronous request
	xmlHttp.send(null);
	xmlHttp.onreadystatechange = function() {
		if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
			var predictions = $($.parseXML(xmlHttp.responseText)).find('bustime-response').find('prd');

			var predictionUsed = -1;
			nextArrivalInMinutes = -1;
			while(nextArrivalInMinutes < minimumNextArrivalMinutes && (predictionUsed + 1) < predictions.length) {
				predictionUsed++;
				nextArrivalInMinutes = parseNextArrivalFromPrediction(predictions[predictionUsed]);
			}

			nextUpdateTime = new Date();
			var nudSeconds = nextUpdateTime.getSeconds();
			nextUpdateTime.setSeconds(nextUpdateTime.getSeconds() + refreshDataEveryNSeconds)
			if(nextArrivalInMinutes == -1)
				nextArrivalInMinutes = "N/A";
			chrome.browserAction.setBadgeText({text: nextArrivalInMinutes + "" });
			drawActiveIcon();
		}
	}
}
function parseNextArrivalFromPrediction(prediction) {
	/*
	<prd>
	  <tmstmp>20160329 16:00</tmstmp>
	  <typ>A</typ>
	  <stpnm>Clark & Montrose</stpnm>
	  <stpid>15518</stpid>
	  <vid>1318</vid>
	  <dstp>13719</dstp>
	  <rt>22</rt>
	  <rtdir>Northbound</rtdir>
	  <des>Howard</des>
	  <prdtm>20160329 16:17</prdtm>
	  <tablockid>22 -505</tablockid>
	  <tatripid>1040921</tatripid>
	  <zone/>
	</prd>
	*/

	var nowString = prediction.getElementsByTagName("tmstmp")[0].innerHTML;
	var y1 = nowString.substr(0,4),
	m1 = nowString.substr(4,2) - 1,
	d1 = nowString.substr(6,2),
	HH1 = nowString.substr(9,2),
	mm1 = nowString.substr(12,2);
	var now = new Date(y1, m1, d1, HH1, mm1, 0);

	var predString = prediction.getElementsByTagName("prdtm")[0].innerHTML;
	var y2 = predString.substr(0,4),
	m2 = predString.substr(4,2) - 1,
	d2 = predString.substr(6,2),
	HH2 = predString.substr(9,2),
	mm2 = predString.substr(12,2);
	var pred = new Date(y2, m2, d2, HH2, mm2, 0);

	var diffMins = Math.round((((pred - now) % 86400000) % 3600000) / 60000);
	return diffMins;
}

//Active Icon Drawing
function drawActiveIcon() {
	var context = document.getElementById('canvas').getContext('2d');
	context.clearRect(0, 0, 19, 19);

	//color in headlights if it's almost here
	if(bgSource == "Bus.png" && nextArrivalInMinutes <= 3) {
		context.moveTo(1, 12);
		context.beginPath();
		context.lineTo(18, 12);
		context.lineTo(18, 15);
		context.lineTo(1, 15);
		context.lineTo(1, 12);
		context.closePath();
		context.fillStyle = "#00ff00";
		context.fill();
	} else if(bgSource.includes("Train") && nextArrivalInMinutes <= 3) {
		context.moveTo(3, 9);
		context.beginPath();
		context.lineTo(14, 9);
		context.lineTo(14, 10);
		context.lineTo(3, 10);
		context.lineTo(3, 9);
		context.closePath();
		context.fillStyle = "#00ff00";
		context.fill();
	}

	var bgImage = new Image();
	bgImage.onload = function() {
		context.drawImage(bgImage, 0, 0);
		drawStatusDots(context); //after the bg image so they don't get drawn on top of
		iconComponentsPendingDraw--;
		setIcon(context);
	};
	iconComponentsPendingDraw++;
	bgImage.src = bgSource;

	if(selectedRoute != "") {
		drawBusRoute(context, selectedRoute);
	}
}
function drawBusRoute(imageContext, route) {
	var startOffset = 4;

	if(route.length > 2) {
		var rt3 = new Image();
		rt3.onload = function() {
			imageContext.drawImage(rt3, startOffset + 8, 4);
			iconComponentsPendingDraw--;
			setIcon(imageContext);
		};
		iconComponentsPendingDraw++;
		rt3.src = route.substr(2,1) + '.png';
	} else {
		startOffset = 6
	}

	if(route.length > 1) {
		var rt2 = new Image();
		rt2.onload = function() {
			imageContext.drawImage(rt2, startOffset + 4, 4);
			iconComponentsPendingDraw--;
			setIcon(imageContext);
		};
		iconComponentsPendingDraw++;
		rt2.src = route.substr(1,1) + '.png';
	} else {
		startOffset = 8
	}

	var rt1 = new Image();
	rt1.onload = function() {
		imageContext.drawImage(rt1, startOffset, 4);
		iconComponentsPendingDraw--;
		setIcon(imageContext);
	};
	iconComponentsPendingDraw++;
	rt1.src = route.substr(0,1) + '.png';
}
function drawStatusDots(imageContext) {
	var secondsUntilNextRefresh = (nextUpdateTime.getTime() - (new Date()).getTime()) / 1000;
	var widthMultiplier = 19 / refreshDataEveryNSeconds;
	for(x = 1; x < secondsUntilNextRefresh * widthMultiplier; x += 3) {
		imageContext.beginPath();
		imageContext.arc(x, 1, 1, 0, Math.PI*2, false);
		imageContext.fillStyle = "red";
		imageContext.fill();
	}
}

//Idle Icon Drawing
function drawIdleIcon() {
	var context = document.getElementById('canvas').getContext('2d');
	var bgImage = new Image();
	bgImage.onload = function() {
		context.clearRect(0, 0, 19, 19);
		context.drawImage(bgImage, 0, 0);
		iconComponentsPendingDraw--;
		setIcon(context);
	};
	iconComponentsPendingDraw++;
	bgImage.src = 'Bus.png';

	var cta = new Image();
	cta.onload = function() {
		context.drawImage(cta, 4, 4);
		iconComponentsPendingDraw--;
		setIcon(context);
	};
	iconComponentsPendingDraw++;
	cta.src = 'cta.png';

	chrome.browserAction.setBadgeText({text: "" });
}

//Helpers
function setIcon(imageContext) {
	if(iconComponentsPendingDraw == 0) {
		var imageData = imageContext.getImageData(0, 0, 19, 19);
		chrome.browserAction.setIcon({
		  imageData: imageData
		});
	}
}
function clearState() {
	iconComponentsPendingDraw = 0;
	window.clearInterval(dataRefreshTimer);
	window.clearInterval(iconRefreshTimer);
	window.clearTimeout(clearIntervalsTimer);
	clearIntervalsTimer = false;
	drawIdleIcon();
	chrome.browserAction.setTitle({title: "Chicago Transit Tracker" });
}
function isRunning() {
	return clearIntervalsTimer;
}
setTimeout(drawIdleIcon, 1000);