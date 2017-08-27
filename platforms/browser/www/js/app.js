window.onload = function() {
    document.addEventListener("deviceready", init, false);
}

storage = Lawnchair({name: 'walk-information'}, function(e) {
	console.log('storage initialized'); 
})

storage.keys('keys.forEach(console.log)'); 


function init() { //run everything in here only when device is ready

	var requestUri = 'http://api-walks.emiliedannenberg.co.uk/list-walks'; 

	var xhr = new XMLHttpRequest();
	    
	xhr.open('GET',requestUri, true);
	xhr.send(null);  

	xhr.onreadystatechange = function() {
	    if (xhr.readyState == XMLHttpRequest.DONE) { 
	        var walks = xhr.responseText;
	        readIntoSelect(walks);        
	    }
	}

	function readIntoSelect(walks) {
		walks= JSON.parse(walks);
		 
		var selectElem=document.querySelector(".choose-walk"); 
		for(var i=0; i<walks.length; i++) {
			var opt=document.createElement("option"); 
			
			opt.text=removeExtAndUnderscore(walks[i]); 

			var value=walks[i].substring(0,walks[i].indexOf('.gpx'));
			opt.value=walks[i].substring(0,walks[i].indexOf('.gpx')); 
			selectElem.add(opt,null); 
		}
	}

	var startWalkBtn = document.querySelector(".start-walk");
    
    startWalkBtn.addEventListener("click", function() {
     	
	    promisedWalkDirections().then(promisedLandmarkDescriptions).then(function(walkData) {
	    	// document.querySelector('.walk-page').style.display = 'block'; 
     		var initializedMap = generateMap(walkData.walkDirections); //return map to update marker on it
     		startTracking(walkData, initializedMap); 
	    }); 
  	});   	
}

var promisedWalkDirections = function() {
	var promise = new Promise(getWalkDirections);
	return promise; 
};

var promisedLandmarkDescriptions = function(walkDirections) {
	var promise = new Promise(function(resolve, reject) {
		var select=document.querySelector(".choose-walk");
    	var selectedValue=select.value; 
    	
    	if(selectedValue !== '') {
   			var walkName = select.options[select.selectedIndex].text;
   // 			storage.keys(function(key) {
			// 	this.remove(walkName+'-landmarks'); 
			// })  

   			storage.get(walkName + '-landmarks', function(landmarkDescriptions) {

   				if(landmarkDescriptions) {
   					resolve({walkDirections: walkDirections, landmarkDescriptions: landmarkDescriptions.value.descriptions}); 
   				} else {
   					//make the request to get the descriptions
   					requestUri = 'http://api-walks.emiliedannenberg.co.uk/get-landmarks/'+selectedValue; 
   				
					var xhr = new XMLHttpRequest();
					    
					xhr.open('GET',requestUri, true);
					xhr.send(null);  

					xhr.onreadystatechange = function() {
				    	if (xhr.readyState == XMLHttpRequest.DONE) { 
				    		if(xhr.status===200) {
				        		var descriptions = xhr.responseText;   
				        		//save descriptions  
				        		storage.save({ key : walkName + '-landmarks', 
										value : {	descriptions: descriptions }
									}, function(doc){	
								});
								console.log('landmark descriptions saved locally!'); 
								resolve({walkDirections: walkDirections, landmarkDescriptions: descriptions})
				        	} else {
				        		reject(xhr.status); 
				        	}
				    	}
					}
   				}
   			}); 
   		}
	}); 
	return promise; 
} 

function removeExtAndUnderscore(filename) {

	var removeExt=filename.substring(0,filename.indexOf('.gpx'));
	var removeUnderscore=removeExt.replace(/_/g,' '); 
	return removeUnderscore; 

}
function getWalkDirections(resolve, reject) {

    var select=document.querySelector(".choose-walk");
    var selectedValue=select.value; 

   	if(selectedValue !== '') {
   		var walkName = select.options[select.selectedIndex].text; 
   
   		storage.get(walkName, function(walkDirections) {
   			if(walkDirections) {
   				resolve(walkDirections); 
   			} else {
			    requestUri = 'http://api-walks.emiliedannenberg.co.uk/get-directions/'+selectedValue; 

				var xhr = new XMLHttpRequest();
				    
				xhr.open('GET',requestUri, true);
				xhr.send(null);  

				xhr.onreadystatechange = function() {
			    	if (xhr.readyState == XMLHttpRequest.DONE) { 
			    		if(xhr.status===200) {
			        		var directions = xhr.responseText;   
			        		saveWalk(resolve, directions);  
			        	} else {
			        		reject(xhr.status); 
			        	}
			    	}
				}
			}
		}); 
	}
}
function saveWalk(resolve, directions) {
	
	directions = JSON.parse(directions); 
	var route = directions.routes[0]; 
	var legs = route.legs; //a leg is a route between two waypoints 	

	var select = document.querySelector(".choose-walk");  
	var walkName = select.options[select.selectedIndex].text; 

	//walk start and end coordinates
	var startCoordinate = directions.waypoints[0].location.join(); 
	var endCoordinate = directions.waypoints[directions.waypoints.length-1].location.join(); 

	var legs = directions.routes[0].legs; 

	for(var i=0; i<legs.length; i++) {
		//remove properties you don't need 
		delete legs[i].distance; 
		delete legs[i].duration; 
		delete legs[i].summary; 
		delete legs[i].weight; 

		//steps keep maneuver, location, type 
		for(var index=0; index<legs[i].steps.length; index++) {

			delete legs[i].steps[index].distance; 
			delete legs[i].steps[index].duration; 
			delete legs[i].steps[index].geometry; 
			// delete legs[i].steps[index].intersections; 
			delete legs[i].steps[index].mode; 
			delete legs[i].steps[index].name; 
			delete legs[i].steps[index].weight; 
			legs[i].steps[index].instruction = legs[i].steps[index].maneuver.instruction; 
			legs[i].steps[index].location = legs[i].steps[index].maneuver.location; 
			legs[i].steps[index].type = legs[i].steps[index].maneuver.type;
			delete legs[i].steps[index].maneuver; 
		}
	}

	storage.save({ key : walkName, 
				   value : {
				   		beginning: startCoordinate,
				   		end : endCoordinate,
				   		legs : legs
				   }
				}, function(doc){	
		console.log('walk saved locally'); 
	});
	
	resolve({ key : walkName, 
				   value : {
				   		beginning: startCoordinate,
				   		end : endCoordinate,
				   		legs : legs
				   }
				}); 	
  }

function error(status) {
	console.log('failed with status code' + status); 
}

function generateMap(coordinateInfo) {
	startCoordinateString = coordinateInfo.value.beginning; 
	startCoordinateArray = startCoordinateString.split(','); //get it into its proper format

	mapboxgl.accessToken = 'pk.eyJ1IjoiZW1pbGllZGFubmVuYmVyZyIsImEiOiJjaXhmOTB6ZnowMDAwMnVzaDVkcnpsY2M1In0.33yDwUq670jHD8flKjzqxg';
	var map = new mapboxgl.Map({
	    container: 'map',
	    style: 'mapbox://styles/mapbox/streets-v9',
	    center: startCoordinateArray,
	    zoom: 15
	});

	//get all step intersection coordinates to plot route. more intersection coordinates means more accurate route plotting
	var routeLegs = coordinateInfo.value.legs; 
	var routeCoordinates = []; 

	for(var i=0;i<routeLegs.length;i++) {
		
		var legSteps = routeLegs[i].steps; 
		for(var index=0; index< legSteps.length; index++) {
			var stepIntersections = legSteps[index].intersections; 
			for(var inter=0; inter< stepIntersections.length; inter++) {
				var intersectionCoordinate=stepIntersections[inter].location; 
				routeCoordinates.push(intersectionCoordinate); 
			}
		}
	}
	console.log(routeCoordinates); 

	map.on('load', function () {

	    map.addLayer({
	        "id": "route",
	        "type": "line",
	        "source": {
	            "type": "geojson",
	            "data": {
	                "type": "Feature",
	                "properties": {},
	                "geometry": {
	                    "type": "LineString",
	                    "coordinates": routeCoordinates
	                }
	            }
	        },
	        "layout": {
	            "line-join": "round",
	            "line-cap": "round"
	        },
	        "paint": {
	            "line-color": "#888",
	            "line-width": 8
	        }
	    });
	});
	return map; 
}

function getLandmarkDescriptions(walkName) {

	var requestUri = 'http://api-walks.emiliedannenberg.co.uk/getLandmarkDescriptions/'+ walkName; 

	var xhr = new XMLHttpRequest();
	    
	xhr.open('GET',requestUri, true);
	xhr.send(null);  

	xhr.onreadystatechange = function() {
	    if (xhr.readyState == XMLHttpRequest.DONE) { 
	        var descriptions = xhr.responseText;
	        saveLandmarkDescriptions(descriptions);        
	    }
	}
}

var waypointsReached = {  //object to track whether you've already hit a waypoint
	start: false, 
	end: false,
	waypoint: [],
	steps: []
}



var showMsgDiv = document.querySelector(".waypoint-text");
function startTracking(walkData, map) {
	// var time = 0; 
	console.log(walkData); 
	//start tracking
	var watch_id= navigator.geolocation.watchPosition(

        //success
        function(position) {
        	console.log(position); 
        
        	var currentLng = position.coords.longitude; 
        	var currentLat = position.coords.latitude; 

        	updateMarkerPosition(currentLng,currentLat, map);

        	//loop through all steps to see if you're at a significant location
        	var coordinateData;
        	var journeyLegs;  

        	coordinateData = walkData.walkDirections.value; 
        	journeyLegs = coordinateData.legs; 
        	
        	for(var i =0; i < journeyLegs.length; i++) {
        		
        		var currentLeg = journeyLegs[i]; 

        		//loop through steps
        		var legSteps = currentLeg.steps; 
        		for(var j =0; j < legSteps.length; j++) {
        			var currentStep = legSteps[j]; 
        			var stepLocation = currentStep.location; 

        			var stepLat; 
        			var stepLng; 

        			stepLat = stepLocation[1]; 
        			stepLng = stepLocation[0]; 
        		
        			//compare geoposition to step position 
        			if(isClose(currentLat, currentLng, stepLat, stepLng)) {
        				// var msg = new SpeechSynthesisUtterance();//ur gunna say something!!

        				//if step type is arrive you're at a waypoint, get waypoint info	
        				if(currentStep.type==="arrive" && notAtEnd(stepLocation, coordinateData.end)) {
        					if(waypointsReached.waypoint.indexOf(i) === -1) {
	        					//get waypoint info. 
	        					console.log('you are at a waypoint');
	        					//get leg, get corresponding waypoint info index
	        					var waypointDescription = getWaypointDescription(i,walkData.landmarkDescriptions);    
	 			 				var msg = waypointDescription; 
	 			 				
	 			 				showMsgDiv.innerHTML += '<p>' + msg + '</p>'; 

	 			 				waypointsReached.waypoint.push(i); 
	        					// msg.text = waypointDescription; 
        					}
        				} 
        				else if(currentStep.type==="arrive" && !notAtEnd(stepLocation, coordinateData.end)) { // you're at the end
        					if(!waypointsReached.end) {

	        					// msg.text = 'walk finished'; 
	        					var msg = 'walk finished'; 

	        					showMsgDiv.innerHTML += '<p>' + msg + '</p>'; 

	        					waypointsReached.end = true; 
	        				}
        				}
        				else if(atBeginning(stepLocation,coordinateData.beginning.split(','))) {
        					if(!waypointsReached.start) {
	        					// msg.text = 'beginning of walk'; 	
	        					var msg = 'beginning of walk'; 

	        					showMsgDiv.innerHTML += '<p>' + msg + '</p>'; 

	        					waypointsReached.start = true; 
        					}
        				}	
        				else if(waypointsReached.steps.indexOf(i+j) === -1) {	 // get instruction 

        					var instruction = currentStep.instruction; 
        					//read this out 
        					// msg.text = instruction; 
        					var msg = instruction;

        					showMsgDiv.innerHTML += '<p>' + msg + '</p>'; 

        					waypointsReached.steps.push(i + j);  
        				}
        				//say your thang
        				// window.speechSynthesis.speak(msg);
        				//now break out of everything
        				j = legSteps.length; 
        				i = journeyLegs.length; 
        			}
        			else { console.log('not close really'); }

        		}
        	} 
        },
        //error
        function(error) {
                console.log('couldnt get coordinates!!!'); 
        },
        //settings
        { frequency: 5000, enableHighAccuracy: true}

    ); 
}

function getWaypointDescription(legIndex, descriptions) {
	
	var infoIndex = legIndex; 
	// var descriptions = descriptions.replace(/(?:\r)/g, '<br />');
	var split = descriptions.split(','); 
	
	return split[infoIndex].trim(); 
}

function notAtEnd(stepCoordinates, walkEndCoordinatesString) {

	stepCoordinates[0] = Number(stepCoordinates[0]).toFixed(3); //roughly at end 
	stepCoordinates[1] = Number(stepCoordinates[1]).toFixed(3); 

	walkEndCoordinates = walkEndCoordinatesString.split(','); 
	walkEndCoordinates[0] = Number(walkEndCoordinates[0]).toFixed(3); 
	walkEndCoordinates[1] = Number(walkEndCoordinates[1]).toFixed(3); 

	return (stepCoordinates[0] === walkEndCoordinates[0] && stepCoordinates[1] === walkEndCoordinates[1]) ? false : true; 
}

function atBeginning(stepCoordinates, walkBeginningCoordinates) {
	stepCoordinates[0] = Number(stepCoordinates[0]).toFixed(3); 
	stepCoordinates[1] = Number(stepCoordinates[1]).toFixed(3);

	walkBeginningCoordinates[0] = Number(walkBeginningCoordinates[0]).toFixed(3); 
	walkBeginningCoordinates[1] = Number(walkBeginningCoordinates[1]).toFixed(3); 

	return (stepCoordinates[0] === walkBeginningCoordinates[0] && stepCoordinates[1] === walkBeginningCoordinates[1]) ? true : false; 
}

function isClose(currentLat, currentLng, stepLat, stepLng) {

	//pretty crude. Check to see if coordinates match to four decimal places 
	//in future probably want to calculate based on trajectory as well. So only counts as close if you are approaching from the right direction... 
	roundedCurrentLat = Number(currentLat).toFixed(3); // round to 4 decimals 
	roundedCurrentLng = Number(currentLng).toFixed(3); 

	roundedStepLat = Number(stepLat).toFixed(3); 
	roundedStepLng = Number(stepLng).toFixed(3); 

	console.log('current Lat' + roundedCurrentLat + '..' + 'step lat' + roundedStepLat); 
	console.log('current Lng' + roundedCurrentLng + '..' + 'step Lng' + roundedStepLng); 


	return (roundedCurrentLat === roundedStepLat && roundedCurrentLng === roundedStepLng) ? true: false; 
}	


var currentMarker; 
var firstFlyTo = true; //first time placing marker
var NEBound; var SWBound; 

function updateMarkerPosition(long,lat,map) { //add marker to map 
	//delete old marker before readding for new position
	if(currentMarker) {
		currentMarker.remove(); 
	}
	currentMarker = new mapboxgl.Marker()
	.setLngLat([long,lat])
	.addTo(map);

	if(firstFlyTo) {

		map.flyTo({
	        center: [long, lat]
	    });
		var mapBounds = map.getBounds(); 
		NEBound = mapBounds._ne; 
		SWBound = mapBounds._sw; 

		firstFlyTo = false; 

			console.log('north east bound is' + NEBound); 
	console.log('north west bound is' + SWBound); 
	}
	else { //check if marker out of bounds
		if(long > NEBound.lng || long < SWBound.lng || lat > NEBound.lat || lat < SWBound.lat) {
			map.flyTo({
	        	center: [long, lat]
	    	});
	    	//get new bounds
	    	var mapBounds = map.getBounds(); 
			NEBound = mapBounds._ne; 
			SWBound = mapBounds._sw; 
			console.log('new bounds are' + NEBound + ' and ' + SWBound)
		}
	}

	// var mapBounds = map.getBounds(); 
	
	// var NEBound = mapBounds._ne; 
	// var SWBound = mapBounds._sw; 

	// //if marker is outside bounds recenter map
	// if((long > NEBound.lng || long < SWBound.lng || lat > NEBound.lat || lat < SWBound.lat) || firstFlyTo === false) {
	// 	map.flyTo({
	//         center: [long, lat]
	//     });
	//     firstFlyTo = true; //want it to fly there first time round ... 
	// }
}

