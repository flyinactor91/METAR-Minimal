/* AVWX - metarBrain.js
 * Michael duPont
 * Displays the current flight rules for a given station
 * Ties into avwx.rest, my public aviation weather service
*/

//--------GeoLocation
var getNearest = localStorage.getItem('getNearest');
if (getNearest === 'true') {
  getNearest = true;
} else {
  getNearest = false;
}

//--------Station ID
var stationID = localStorage.getItem('stationID');
if ((stationID === null)||(stationID.length != 4)) { stationID = 'KJFK'; }

/***************************** AVWX fetch functions *******************************/

//Retrieve and parse JSON object for a given url
//Calls handleRequest with fetched object
//@param url The url to fetch
var updateReport = function(url) {
  var request = new XMLHttpRequest();
  request.onload = function() {
    console.log(request.responseText);
    var resp = JSON.parse(request.responseText);
    if (('Error' in resp) || (!('Flight-Rules' in resp))) {
      sendDictionaryToPebble({'KEY_STATION': 'GOT', 'KEY_CONDITION': 'ERR'});
    } else {
      sendDictionaryToPebble({'KEY_STATION': resp.Station, 'KEY_CONDITION': resp['Flight-Rules']});
    }
  };
  console.log('Now Fetching: ' + url);
  request.open('GET', url, true);
  request.send();
};

//Called when position lookup is succesful
//@param pos A Pebble position object
function locationSuccess(pos) {
  var latitude = pos.coords.latitude;
  var longitude = pos.coords.longitude;
  console.log('Latitude = ' + latitude.toString());
  console.log('Longitude = ' + longitude.toString());
  var url = 'http://avwx.rest/api/metar.php?lat=' + latitude.toString() + '&lon=' + longitude.toString() + '&format=JSON';
  updateReport(url);
}

//Called when getNearest is true
function useGeoURL() {
  navigator.geolocation.getCurrentPosition(
    locationSuccess,
    function(err) {
      console.log('Error requesting location! ' + err.toString());
      sendDictionaryToPebble({'KEY_STATION': 'NEED', 'KEY_CONDITION': 'GEO'});
    },
    {timeout: 15000, maximumAge: 60000}
  );
}

/**************************** Pebble comm/listeners ******************************/

//Send a dictionary to the Pebble
function sendDictionaryToPebble(dictionary) {
  Pebble.sendAppMessage(dictionary,
    function(e) {
      console.log('Status sent to Pebble successfully!');
    },
    function(e) {
      console.log('Error sending status to Pebble!');
    }
  );
}

//Handler for update request
function handleUpdate() {
  if (getNearest === true) {
    useGeoURL();
  } else if (stationID !== '') {
    var url = 'http://avwx.rest/api/metar.php?station=' + stationID + '&format=JSON';
    updateReport(url);
  } else {
    sendDictionaryToPebble({'KEY_STATION': 'GOTO', 'KEY_CONDITION': 'STNG'});
  }
}

//Listen for when the watchface is opened
Pebble.addEventListener('ready', 
  function(e) {
    console.log('PebbleKit JS ready!');
    handleUpdate();
  }
);

// Listen for when an AppMessage is received
Pebble.addEventListener('appmessage',
  function(e) {
    console.log('AppMessage received!');
    handleUpdate();
  }                     
);

//Listen for when user opens config page
Pebble.addEventListener('showConfiguration', function(e) {
  //Show config page
  console.log('Now showing config page');
  Pebble.openURL('http://mdupont.com/Pebble-Config/pebble-metar-watchface-setup-3-2.html?station=' + stationID + '&near=' + getNearest.toString());
});

//Listen for when user closes config page
Pebble.addEventListener('webviewclosed',
  function(e) {
    console.log('Configuration window returned: ' + e.response);
    if (e.response.length !== 0) {
      var options = JSON.parse(decodeURIComponent(e.response));
      console.log('Options = ' + JSON.stringify(options));
      if (options.stationID !== '') { localStorage.setItem('stationID', options.stationID); }
      localStorage.setItem('getNearest', options.getNearest);
    }
  }
);