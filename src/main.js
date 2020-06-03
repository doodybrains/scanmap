import Map from './map';
import Form from './form';
import {get, el} from './util';
import config from '../config';
import setupCams from './cams';
import mapboxgl from 'mapbox-gl';

// Last seen log timestamp
let lastSeen = 0;

// When markers expire
let expireTime = 60 * 60 * 1000; // in ms. One hour
const minMarkerOpacity = 0.1;

const markers = {};
const updateInterval = 5000; // ms
let errs = [];

const LABELS = {
  'other': '',
  'police_presence':'👮',
  'units_requested':'🚓',
  'fire': '🔥',
  'prisoner_van': '🚐',
  'group': '🚩',
  'injury': '🩹',
  'barricade': '🚧'
};
const labelsEl = document.getElementById('label');
Object.keys(LABELS).forEach((label) => {
  let el = document.createElement('option');
  el.innerText = `${LABELS[label]} ${label}`
  el.value = label;
  labelsEl.appendChild(el);
});

// Check for updates
setInterval(() => {
  get('/version', (json) => {
    if (VERSION != json.version) {
      console.log('New version detected, reloading...');
      location.reload();
    }
  });
}, 5000);

function update() {
  get('log', (json) => {
    json.logs.forEach((l) => {
      if (l.timestamp > lastSeen) {
        let dt = new Date(l.timestamp*1000).toLocaleString('en-US');

        // Add marker to map
        let coords = l.coordinates.split(',').map((c) => parseFloat(c));
        if (coords.length == 2) {
          coords.reverse();

          // Check if marker exists for this location,
          // if so, append log
          let key = `${coords[0]}_${coords[1]}`;
          if (key in markers) {
            let popup = markers[key].marker.getPopup();

            let icon = l.label ? LABELS[l.label] : null;
            let markerEl = markers[key].marker.getElement();
            if (icon) {
              markerEl.innerText = icon;
              markerEl.style.background = 'none';
            } else {
              markerEl.innerText = '';
              markerEl.style.background = 'red';
            }

            let popupEl = popup._content;
            let newLog = document.createElement('div');
            newLog.className = 'popup-log';

            if (l.label) {
              let newLogLabel = document.createElement('div');
              newLogLabel.className = 'popup-label';
              newLogLabel.innerText = `${LABELS[l.label]} ${l.label}`;
              newLog.appendChild(newLogLabel);
            }

            let newLogWhen = document.createElement('div');
            newLogWhen.className = 'popup-when';
            newLogWhen.innerText = dt;
            newLog.appendChild(newLogWhen);

            let newLogText = document.createElement('h3');
            newLogText.innerText = l.text;
            newLog.appendChild(newLogText);
            popupEl.querySelector('.popup-logs').prepend(newLog);

            markers[key].lastUpdate = l.timestamp*1000;
          } else {
            let desc = `
              <div class="popup-location">${l.location}</div>
              <div class="popup-logs">
                <div class="popup-log">
                  ${l.label ? `<div class="popup-label">${LABELS[l.label]} ${l.label}</div>` : ''}
                  <div class="popup-when">${dt}</div>
                  <h3>${l.text}</h3>
                </div>
              </div>`;
            let icon = l.label ? LABELS[l.label] : null;
            markers[key] = {
              lastUpdate: l.timestamp*1000,
              marker: map.addMarker(coords, {desc, icon})
            };
          }
        }

        // Add to log sidebar
        let logEl = document.getElementById('log');
        let logItem = el({
          tag: 'div',
          className: 'logitem',
          children: [{
            tag: 'div',
            className: 'logitem-when',
            innerText: dt,
          }, {
            tag: 'div',
            className: 'logitem-location',
            innerText: `${l.label && l.label !== 'other' ? `${LABELS[l.label]} ${l.label} @ ` : ''}${l.location}`
          }, {
            tag: 'div',
            className: 'logitem-text',
            innerText: l.text
          }]
        });
        logEl.prepend(logItem);

        if (coords.length == 2) {
          logItem.addEventListener('click', () => {
            map.jumpTo(coords);
          });
        }
        lastSeen = l.timestamp;
      }
    });
  }).catch((err) => {
    console.log(err);
    errs.push(err);
  });

  // Fade out markers
  let now = new Date().getTime();
  Object.keys(markers).forEach((k) => {
    let {marker, lastUpdate} = markers[k];
    let fade = Math.max(0, 1 - (now - lastUpdate)/expireTime);
    if (fade < 0.1)
    marker.getElement().style.opacity = Math.max(fade, 0.1);
  });
}


mapboxgl.accessToken = config.MAPBOX_TOKEN;
const map = new Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  zoom: 12,
  maxZoom: 18,
  minZoom: 10,
  center: MAP_CENTER
}, (coord) => {
  document.getElementById('coordinates').value = `${coord.lat},${coord.lng}`;
});

document.getElementById('add').addEventListener('click', () => {
  let form = new Form(map);
  form.activate();
});

update();
setInterval(update, updateInterval);
setupCams(map);
