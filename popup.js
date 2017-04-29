var apiKey = "5JfdGQtTUgUaUzqmvwAydjMNp";

function init() {
	loadPinnedStops();
	if(chrome.extension.getBackgroundPage().isRunning() == false) {
		$("#stop").hide();
	}
	$("#stop").click(function(e) {
		chrome.extension.getBackgroundPage().clearState();
		window.close();
	});
	$("#add").click(function(e) {
		$("#pinnedStopSection").hide();
		getRoutes();
	});
	$("#settings").click(function(e) {
		$("#pinnedStopSection").hide();
		$("#settingsSection").show();
	});
	$("#settingsBack").click(function(e) {
		showPinnedStops();
	});
	$("#saveSettings").click(function(e) {
		saveSettings();
	});
	chrome.storage.sync.get([ 'ctaRefreshDataEveryNSeconds', 'ctaTrackForNMinutes', 'ctaMinimumNextArrivalMinutes' ], function (result) {
		if(result.ctaRefreshDataEveryNSeconds > 0) {
			$('#refreshSeconds').val(result.ctaRefreshDataEveryNSeconds);
		} else {
			$('#refreshSeconds').val("30");
		}
		if(result.ctaTrackForNMinutes > 0) {
			$('#trackMinutes').val(result.ctaTrackForNMinutes);
		} else {
			$('#trackMinutes').val("10");
		}
		if(result.ctaMinimumNextArrivalMinutes > 0) {
			$('#minimumNextArrivalMinutes').val(result.ctaMinimumNextArrivalMinutes);
		} else {
			$('#minimumNextArrivalMinutes').val("0");
		}
	});
}

//Pinned Stop logic
function showPinnedStops() {
	$("#settingsSection").hide();
	$('#addStop').empty();
	$("#pinnedStopSection").show();
	$('body').height("1px");
	$('html').height("1px");
	loadPinnedStops();
}
function loadPinnedStops() {
	$('#addStop').empty();
	$('#pinnedStops').empty();
	chrome.storage.sync.get('pinnedCtaStops', function (result) {
		if(result.pinnedCtaStops && result.pinnedCtaStops.length > 0) {
			result.pinnedCtaStops.split('~').forEach(function(stopData) {
				var splitStopData = stopData.split("|");
				$('#pinnedStops').append("<a href='#' class='runCtaStop btn btn-default btn-sm' role='button' id='" + splitStopData[0] + ":" + splitStopData[1] + "'>" + splitStopData[2] + "</a>");
				$('#pinnedStops').append("<a style='float:right' class='unpinCtaStop btn btn-default btn-xs' role='button' href='#' id='" + splitStopData[0] + ":" + splitStopData[1] + "'>X</a>");
				$('#pinnedStops').append("<br />");
			});
			$(".runCtaStop").click(runCtaStop);
			$(".unpinCtaStop").click(unPinCtaStop);
		}
	});
}
function runCtaStop(stopInfo) {
	var data = stopInfo.target.id.split(":");
	chrome.extension.getBackgroundPage().startTracking(data[0], data[1], stopInfo.target.text);
	window.close();
}
function unPinCtaStop(stopInfo) {
	var data = stopInfo.target.id.split(":");
	chrome.storage.sync.get('pinnedCtaStops', function (result) {
		var startIndex = result.pinnedCtaStops.indexOf(data[0] + "|" + data[1]);
		var textToRemove = result.pinnedCtaStops.substring(startIndex).split('~')[0];
		var newText = result.pinnedCtaStops.replace(textToRemove, "").replace("~~", "~");
		if(newText.startsWith('~'))
			newText = newText.substring(1);
		if(newText.endsWith('~'))
			newText = newText.substring(0, newText.length - 1);
		console.log(newText);
		chrome.storage.sync.set({'pinnedCtaStops': newText });
		loadPinnedStops();
	});
}

//Settings logic
function saveSettings() {
	chrome.storage.sync.set({'ctaRefreshDataEveryNSeconds': $('#refreshSeconds').val() });
	chrome.storage.sync.set({'ctaTrackForNMinutes': $('#trackMinutes').val() });
	chrome.storage.sync.set({'ctaMinimumNextArrivalMinutes': $('#minimumNextArrivalMinutes').val() });
	showPinnedStops();
}

//Add Stop Logic
var routeId;
var routeName;
var direction;
function getRoutes() {
	$('#addStop').empty();
	$('#addStop').append("<a href='#' class='back btn btn-default' role='button'>Back</a><br /><br />");
	$(".back").click(function() {
		showPinnedStops();
	});

	var xmlHttp = new XMLHttpRequest();
	xmlHttp.open("GET", "http://ctabustracker.com/bustime/api/v1/getroutes?key=" + apiKey, true);
	xmlHttp.send(null);
	xmlHttp.onreadystatechange = function() {
		if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
			var routes = $($.parseXML(xmlHttp.responseText)).find('bustime-response').find('route');
			Array.from(routes).forEach(function(thisRoute) {
				var thisRouteId = thisRoute.getElementsByTagName("rt")[0].innerHTML;
				var thisRouteName = thisRoute.getElementsByTagName("rtnm")[0].innerHTML;
				$('#addStop').append("<a href='#' class='selectRoute' id='" + thisRouteId + "'>" + thisRouteId + " " + thisRouteName + "</a><br />");
			});
			$(".selectRoute").click(getDirections);
		}
	}
}
function getDirections(rte) {
	$('#addStop').empty();
	$('#addStop').append("<a href='#' class='back btn btn-default' role='button'>Back</a><br /><br />");
	$(".back").click(function() {
		getRoutes();
	});

	if(rte) {
		routeId = rte.target.id;
		routeName = rte.target.text;
	}

	var xmlHttp = new XMLHttpRequest();
	xmlHttp.open("GET", "http://ctabustracker.com/bustime/api/v1/getdirections?key=" + apiKey + "&rt=" + routeId, true);
	xmlHttp.send(null);
	xmlHttp.onreadystatechange = function() {
		if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
			var directions = $($.parseXML(xmlHttp.responseText)).find('bustime-response').find('dir');
			Array.from(directions).forEach(function(thisDirection) {
				var thisDirectionId = thisDirection.innerHTML;
				$('#addStop').append("<a href='#' class='selectDirection' id='" + thisDirectionId + "'>" + thisDirectionId + "</a><br />");
			});
			$(".selectDirection").click(getStops);
		}
	}
}
function getStops(dir) {
	$('#addStop').empty();
	$('#addStop').append("<a href='#' class='back btn btn-default' role='button'>Back</a><br /><br />");
	$(".back").click(function() {
		getDirections();
	});

	if(dir) {
		direction = dir.target.id;
	}

	var xmlHttp = new XMLHttpRequest();
	xmlHttp.open("GET", "http://ctabustracker.com/bustime/api/v1/getstops?key=" + apiKey + "&rt=" + routeId + "&dir=" + direction, true);
	xmlHttp.send(null);
	xmlHttp.onreadystatechange = function() {
		if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
			var stops = $($.parseXML(xmlHttp.responseText)).find('bustime-response').find('stop');
			Array.from(stops).forEach(function(thisStop) {
				var thisStopId = thisStop.getElementsByTagName("stpid")[0].innerHTML;
				var thisStopName = thisStop.getElementsByTagName("stpnm")[0].innerHTML;
				$('#addStop').append("<a href='#' class='selectStop' id='" + thisStopId + "'>" + thisStopName + "</a><br />");
			});
			$(".selectStop").click(addStop);
		}
	}
}
function addStop(stp) {
	var stopId = stp.target.id;
	var stopName = stp.target.text;

	chrome.storage.sync.get('pinnedCtaStops', function (result) {
		var newText = "";
		if(result.pinnedCtaStops && result.pinnedCtaStops.length > 0)
		{
			newText = result.pinnedCtaStops + "~";
		}
		newText = newText + routeId + '|' + stopId + '|' + routeName + " " + direction + " Bus at " + stopName;
		if(newText.startsWith('~'))
			newText = newText.substring(1);
		chrome.storage.sync.set({'pinnedCtaStops': newText });
		showPinnedStops();
	});
}
document.addEventListener('DOMContentLoaded', init);