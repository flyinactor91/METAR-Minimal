var stationID = localStorage.getItem("stationID");
if ((stationID === null)||(stationID.length != 4)) { stationID = "KJFK"; }
var altimeter = "";
var temperature = "";
var dewpoint = "";
var time = "";
var windDirection = "";
var windSpeed = "";
var visibility = "";
var clouds = "";
var flightCondition = "";
var allCloudsList = [];
var cloudCodeList = ["CLR","SKC","FEW","SCT","BKN","OVC"];

/*function printList(someList) {
  var ret = "";
  for (var i=0; i<someList.length; i++) {
    ret += someList[i] + "";
  }
  return ret;
}*/

var xhrRequest = function (url, type, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    callback(this.responseText);
  };
  xhr.open(type, url);
  xhr.send();
};

function parseHTML(html) {
  var rawMETAR = "";
  if (html.indexOf("<code>"+stationID+" ") != -1) {
    var startIndex = html.indexOf("<code>"+stationID+" ") + 6;
    var endIndex = html.substring(startIndex).indexOf("<") + startIndex;
    rawMETAR = html.substring(startIndex, endIndex);
    if (rawMETAR.indexOf(" RMK ") != -1) {
      rawMETAR = rawMETAR.substring(0, rawMETAR.indexOf(" RMK "));
    }
  } else {
    console.log("Could not find start of METAR :(");
  }
  return rawMETAR;
}

function parseAltimeter(rawList) {
  altimeter = ".....";
  if (rawList.length != 0) {
    if (rawList[rawList.length-1][0] == "A") {
      altimeter = rawList.pop().substring(1);
      altimeter = altimeter.substring(0,2) + "." + altimeter.substring(2);
      //console.log("Altimeter = " + altimeter);
    }
  }
  return rawList;
}

function parseTempAndDew(rawList) {
  temperature = "...";
  dewpoint = "...";
  if (rawList.length != 0) {
    var slashIndex = rawList[rawList.length-1].indexOf("/");
    if (slashIndex != -1) {
      var tempAndDew = rawList.pop().split('/');
      temperature = tempAndDew[0].replace("M","-");
      dewpoint = tempAndDew[1].replace("M","-");
      //console.log("Temperature = " + temperature);
      //console.log("Dewpoint = " + dewpoint);
    }
  }
  return rawList;
}

function parseTime(rawList) {
  time = "..:..Z";
  if (rawList.length != 0) {
    if (rawList[0][rawList[0].length-1] == "Z") {
      time = rawList.shift().substring(2);
      time = time.substring(0,2) + ":" + time.substring(2);
      //console.log("Time = " + time);
    }
  }
  return rawList;
}

function parseWinds(rawList) {
  windDirection = "...\xB0";
  windSpeed = "..KT";
  if (rawList.length != 0) {
    var wind = rawList[0];
    if ((wind.substring(wind.length-2) == "KT") || (wind.substring(wind.length-3) == "KTS") || ((wind.length > 7) && (wind.indexOf("G") != -1))) {
      wind = rawList.shift();
      windDirection = wind.substring(0,3) + "\xB0";
      windSpeed = wind.substring(3);
      /*var gIndex = windSpeed.indexOf("G");
      console.log(gIndex + " from " + windSpeed);
      if (gIndex != -1) {
        windSpeed = windSpeed.substring(0,gIndex) + " " + windSpeed.substring(gIndex);
      } else {
        
      }*/
      //console.log("Wind Direction = " + windDirection);
      //console.log("Wind Speed = " + windSpeed);
    }
  }
  if (rawList.length != 0) {
    if ((rawList[0].length == 7) && (rawList[0][3] == "V") && (!isNaN(rawList[0].substring(0,3))) && (!isNaN(rawList[0].substring(4)))) {
      rawList.shift();
    }
  }
  return rawList;
}

function parseVisibility(rawList) {
  visibility = "...";
  if (rawList.length != 0) {
    if (rawList[0].indexOf("SM") != -1) {
      var vis = rawList.shift();
      visibility = eval(vis.substring(0, vis.length - 2)).toString();
    } else if (rawList[0] == "9999") {
      visibility = "10";
      rawList.shift();
    } else if ((rawList.length > 1) && (rawList[1].indexOf("SM") != -1)) {
      var vis1 = eval(rawList.shift());
      var vis2 = rawList.shift();
      vis2 = eval(vis2.substring(0, vis2.length - 2));
      vis1 = vis1 + vis2;
      visibility = vis1.toString();
    }
    if (visibility.length > 3) {
      if (visibility[0] == "0") {
        visibility = visibility.substring(1,4);
      } else {
        visibility = visibility.substring(0,3);
      }
    }
    //console.log("Visibility = " + visibility);
  }
  return rawList;
}

function parseClouds(rawList) {
  clouds = "";
  var cloudList = [];
  if (rawList.length != 0) {
    for (var i=rawList.length-1; i>-1; i--) {
      if (cloudCodeList.indexOf(rawList[i].substring(0,3)) != -1) {
        cloudList.push(rawList[i].substring(0,6));
        rawList.splice(i,1);
      } else if ((rawList[i].length == 5) && (rawList[i].substring(0, 2) == "VV")) {
        cloudList.push(rawList[i].substring(0,5));
        rawList.splice(i,1);
      }
    }
    if (cloudList.length == 1) { clouds = cloudList[0]; }
    else if (cloudList.length >= 2) { clouds = cloudList[cloudList.length-1] + " " + cloudList[cloudList.length-2]; }
    //console.log("Clouds = " + clouds);
    //console.log("cloudList = " + printList(cloudList));
    allCloudsList = cloudList;
  }
  return rawList;
}

function removeRunwayVis(rawList) {
  if (rawList.length != 0) {
    for (var i=rawList.length-1; i>-1; i--) {
      if ((rawList[i][0] == "R") && (rawList[i].indexOf("/") != -1)) {
        //console.log(rawList[i]);
        rawList.splice(i,1);
      }
    }
  }
  return rawList;
}

function parseMETAR(raw) {
  var rawList = raw.split(" ");
  var loc = rawList.indexOf("AUTO");
  if (loc != -1) { rawList.splice(loc, 1); }
  loc = rawList.indexOf("CLR");
  if (loc != -1) { rawList.splice(loc, 1); }
  rawList = parseAltimeter(rawList);
  rawList = parseTempAndDew(rawList);
  rawList.shift();
  rawList = parseTime(rawList);
  rawList = parseWinds(rawList);
  rawList = parseVisibility(rawList);
  rawList = parseClouds(rawList);
}

function getCeiling(cloudList) {
  for (var i=0; i<cloudList.length; i++) {
    if (cloudList[i].indexOf("/") == -1) {
      //console.log("Now Checking: " + cloudList[i]);
      if ((cloudList[i].substring(0,3) == "OVC") || (cloudList[i].substring(0,3) == "BKN") || (cloudList[i].substring(0,2) == "VV")) {
        //console.log("Now returning: " + cloudList[i]);
        return cloudList[i];
      }
    }
  }
  return "";
}

function getFlightRules() {
  var vis = visibility;
  var cld = getCeiling(allCloudsList);
  //console.log("Getting Ceiling with '" + vis + "' and '" + cld + "'");
  if (vis == "") {
    flightCondition = "IFR";
    return;
  } else {
    vis = eval(vis);
  }
  if (cld != "") {
    cld = parseFloat(cld.substring(cld.length-3));
  } else { cld = 99; }
  //console.log("Getting Ceiling with '" + vis.toString() + "' and '" + cld.toString() + "'");
  if ((vis < 5) || (cld < 30)) {
    if ((vis < 3) || (cld < 10)) {
      if ((vis < 1) || (cld < 5)) {
        flightCondition = "LIFR";
        return;
      }
      flightCondition = "IFR";
      return;
    }
    flightCondition = "MVFR";
    return;
  }
  flightCondition = "VFR";
}

function updateMETAR() {
  var url = "http://www.aviationweather.gov/metar/data?ids="+stationID+"&format=raw&date=0&hours=0";
  xhrRequest(url, 'GET', 
    function(responseText) {
      var metar = parseHTML(responseText);
      console.log(metar);
      parseMETAR(metar);
      getFlightRules();
      //console.log("Flight Rules = " + flightCondition);
      
      var dictionary = {
        "KEY_STATION": stationID,
        "KEY_CONDITION": flightCondition
      };
      // Send to Pebble
      Pebble.sendAppMessage(dictionary,
        function(e) {
          console.log("METAR info sent to Pebble successfully!");
        },
        function(e) {
          console.log("Error sending METAR info to Pebble!");
        }
      );
    }      
  );
}

// Listen for when the watchface is opened
Pebble.addEventListener('ready', 
  function(e) {
    console.log("PebbleKit JS ready!");
    updateMETAR();
  }
);

// Listen for when an AppMessage is received
Pebble.addEventListener('appmessage',
  function(e) {
    console.log("AppMessage received!");
    updateMETAR();
  }                     
);

Pebble.addEventListener('showConfiguration', function(e) {
  // Show config page
  console.log("Now showing config page");
  Pebble.openURL('http://mdupont.com/Pebble-Config/pebble-metar-watchface-setup.html');
});

Pebble.addEventListener('webviewclosed',
  function(e) {
    console.log('Configuration window returned: ' + e.response);
    var options = JSON.parse(decodeURIComponent(e.response));
    //console.log("Options = " + JSON.stringify(options));
    localStorage.setItem("stationID", options.stationID);
    updateMETAR();
  }
);