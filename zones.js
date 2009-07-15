var SVG_NS ="http://www.w3.org/2000/svg";
var defaultZoom = 13;

var LATLNG_PRECISION = 6;

var translate = {
    name: 'Name',
    lat: 'Latitude',
    lng: 'Longitude',
    radius: 'Radius (m)'
}

var gmap;
var highlighted = [];
var deletedObjs = [];

function setup() {
    zoneList.init();
    propBox.init();
    var parentNode = document.getElementById("mapEmbed");
    gmap = new GMap2(parentNode);
    gmap.addControl(new GLargeMapControl());
    gmap.addControl(new GMapTypeControl());
    gmap.setCenter(new GLatLng(25.045, 121.518), defaultZoom);
}

function loadJSON(json) {
    var values = JSON.parse(json);
    for (var i=0; i<values.length; i++) {
        var obj = values[i];

        if (obj.type == "circle") {
            var latlng = new GLatLng(obj.lat, obj.lng);
            var circle = new ZoneCircle(latlng, 0, obj.name, obj.id);
            circle.jsonInit(obj.radius);
            gmap.addOverlay(circle);
        }
    }
}

function exportJSON(spacer) {
    var out = [];

    for (var i=0; i<zoneList.zones.length; i++) {
        var shape = zoneList.zones[i];
        if (!shape._changed) continue;
        var obj = shape.getJsonObj();
        if (obj.id != undefined) obj.action = "modify";
        else obj.action = "add";
        out.push(obj);
    }
    
    for (var i=0; i<deletedObjs.length; i++) {
        var obj = deletedObjs[i];
        out.push({id: obj.id, action: "delete"});
    }

    return JSON.stringify(out, undefined, spacer);

}


function addZone() {
    //typeBox = document.getElementById("zoneType");
    setInstructions("Click on the map");
    gmap.disableDragging();
    GEvent.addListener(gmap, "click", createZoneCircle);
}

function setInstructions(msg) {
    instructions = document.getElementById("instructions");
    instructions.innerHTML = msg;
}

function setHighlight(objs) {
    for (var i=0; i<highlighted.length; i++) {
        highlighted[i].highlight(false);
    }
    highlighted = objs;
    for (var i=0; i<highlighted.length; i++) {
        highlighted[i].highlight(true);
    }

    if (highlighted.length = 1) {
        propBox.switchObject(highlighted[0]);
    } else {
        propBox.clear();
    }

}

function createZoneCircle(e, latlng) {
    var circle = new ZoneCircle(latlng, 0);
    gmap.addOverlay(circle);
    circle.init();
    propBox.switchObject(circle);
}


/**********************************
 Zone List (singleton)
**********************************/

var zoneList = new function() {

    this.init = function() {
        this.div = document.getElementById("zoneList");
        this.zones = [];
    };

    this.addZone = function(obj) {
        this.zones.push(obj);
        this.addOne(obj);
    };

    this.removeZone = function(obj) {
        for (var i=0; i < this.zones.length; i++) {
            if (this.zones[i] === obj) {
                this.zones.splice(i, 1);
                this.div.removeChild(obj._link);
                break;
            }
        }
    };

    this.redraw = function() {

        while(this.div.hasChildNodes()) {
            this.div.removeChild(this.div.firstChild);
        }

        for (var i=0; i < this.zones.length; i++) {
            var link = this.addOne(this.zones[i]);
        }

    };

    this.addOne = function(obj) {
        this.div.appendChild(obj._link);
        return obj._link;
    };

}


/**********************************
 Property Box (singleton)
**********************************/

var propBox = new function() {

    this.init = function() {
        this.div = document.getElementById("propBox");
        this.values = {};
    };

    this.clear = function() {
        this.fields = {};
        this.values = {};
        this.obj = undefined;
        this._empty();
    };

    this.clearIfActive = function(obj) {
        if (this.obj === obj) this.clear();
    };

    this.switchObject = function(obj) {
        this.obj = obj;
        this.fields = obj.getEditableFieldDict();
        this.redraw();
    };

    this.updateValue = function(obj, field, newValue) {
        if (this.obj === obj) {
            this.values[field].innerHTML = newValue;
        }
    };

    this._empty = function() {
        while(this.div.hasChildNodes()) {
            this.div.removeChild(this.div.firstChild);
        }
    };

    this.redraw = function() {

        this._empty();

        var table = document.createElement("table");

        for (var i = 0; i < this.fields.length; i+=2) {
            var row = document.createElement("tr");
            row.appendChild(this._label(this.fields[i]));

            var value = this._value(this.fields[i+1]);
            this.values[this.fields[i]] = value;
            row.appendChild(value);
            table.appendChild(row);
        }

        var obj = this.obj;
        var self = this;

        var row = document.createElement("tr");
        var td = document.createElement("td");
        td.setAttribute("colspan", "2");

        var div = document.createElement("div");
        div.style.display = "none";
        div.appendChild(this._button("Save", function() { self.save(); }));
        div.appendChild(this._button("Cancel", function() { self.cancel(); }));
        td.appendChild(div);        
        row.appendChild(td);
        row.setAttribute("class", "buttonRow");

        table.appendChild(row);

        this._editButtonDiv = div;

        row = document.createElement("tr");
        row.setAttribute("class", "buttonRow");
        td = document.createElement("td");
        td.setAttribute("colspan", "2");

        td.appendChild(this._button("Move", function() { obj.move(); }));
        td.appendChild(this._button("Resize", function() { obj.resize(); }));
        td.appendChild(this._button("Edit", function() { self.edit() }));
        td.appendChild(this._button("Delete", function() { 
            if (confirm("Delete '" + obj.name + "'?")) gmap.removeOverlay(obj);
        }));

        row.appendChild(td);
        table.appendChild(row);

        this._generalButtonRow = row;

        this.div.appendChild(table);

    };

    this.edit = function() {
        this._showEditButtons();
        this._origFields = this.fields.slice();
        this._editBoxes = {};

        for (var i=0; i<this.fields.length; i+=2) {
            var field = this.fields[i];
            var value = this.values[field];
            
            var input = document.createElement("input");
            input.setAttribute("type", "text");
            input.setAttribute("value", value.innerHTML);
            input.setAttribute("size", 20);
            
            while(value.hasChildNodes()) value.removeChild(value.firstChild);

            value.appendChild(input);
            this._editBoxes[field] = input;
        }

    };

    this.save = function() {
        for (var i=0; i<this.fields.length; i+=2) {
            var field = this.fields[i];
            var input = this._editBoxes[field];
            var newValue = input.value;
            this.fields[i+1] = newValue;
            this.obj.setValue(field, newValue);
        }
        this.obj.saveFinished();
        this.switchObject(this.obj);
    };

    this.cancel = function() {
        this.fields = this._origFields;
        this.switchObject(this.obj);
    };

    this._showEditButtons = function() {
        var buttons = this._generalButtonRow.getElementsByTagName("input");
        for (var i=0; i<buttons.length; i++) {
            buttons[i].setAttribute("disabled", "disabled");
        }
        this._editButtonDiv.style.display="block";
    };

    this._label = function(text) {

        label = translate[text] || text;
        var div = document.createElement("th");
        div.appendChild(document.createTextNode(label));
        return div;
    };
    
    this._value = function(value) {
        var div = document.createElement("td");
        div.appendChild(document.createTextNode(value));
        return div;
    };

    this._button = function(name, callback) {
        var button = document.createElement("input");
        button.setAttribute("type", "button");
        button.setAttribute("value", name);
        button.addEventListener("click", callback, false);
        return button;
    }

}


/**********************************
 Common
**********************************/
function createZoneListEntry() {
    var link = document.createElement("a");
    link.setAttribute("href", "#");
    link.appendChild(document.createTextNode(this.name));
    var self = this;
    link.addEventListener("click", function() { setHighlight([self]); }, false),
    this._link = link;
}



/**********************************
 Circle
**********************************/

function ZoneCircle(center, radius, name, dbid) {
    this.center = center;
    this.radius = radius || 5;
    this.name = name;
    this._dbid = dbid;
    this._changed = false;
    this.color = "#99f";
}

ZoneCircle.prototype = new GOverlay();
ZoneCircle.prototype.createZoneListEntry = createZoneListEntry;

ZoneCircle.prototype.init = function() {
    this.dragSize(this.center);
    GEvent.clearListeners(gmap);
    GEvent.bind(gmap, "click", this, 
                function(e, latlng) { 
                    this.setRadius(e, latlng);
                    this.name = prompt("Circle Name");
                    this.createZoneListEntry();
                    zoneList.addZone(this);
                    setHighlight([this]);
                });
    GEvent.bind(gmap, "mousemove", this, this.dragSize);
    setInstructions("Drag to size, click to set");
}

ZoneCircle.prototype.jsonInit = function(radius) {
    this.radius = this.radiusFromMeters(radius);
    this.createZoneListEntry();
    zoneList.addZone(this);
}

ZoneCircle.prototype.resize = function() {
    setInstructions("Click to start resize");
    gmap.disableDragging();
    GEvent.bind(gmap, "click", this, this.startResize);
}

ZoneCircle.prototype.startResize = function(e, latlng) {
    this.dragSize(latlng);
    GEvent.clearListeners(gmap);
    GEvent.bind(gmap, "click", this, this.setRadius);
    GEvent.bind(gmap, "mousemove", this, this.dragSize);
    setInstructions("Drag to size, click to set");
}

ZoneCircle.prototype.setRadius = function (e, latlng) {
    this.dragSize(latlng);
    this._changed = true;
    GEvent.clearListeners(gmap);
    gmap.enableDragging();
    setInstructions("");
}

ZoneCircle.prototype.dragSize = function(latlng) {

    var lngOffset = latlng.lng() - this.center.lng();
    var latOffset = latlng.lat() - this.center.lat();

    this.radius = Math.sqrt((lngOffset*lngOffset) + (latOffset*latOffset));
    this.redraw(true);
    this.updateRadiusDisplay(latlng);

}

ZoneCircle.prototype.updateRadiusDisplay = function(latlng) {
    var edge = new GLatLng(this.center.lat(), this.center.lng() + this.radius);
    var dist = Math.round(this.center.distanceFrom(edge));
    propBox.updateValue(this, 'radius', dist + "m");
}


ZoneCircle.prototype.move = function() {
    setInstructions("Click to start move");
    gmap.disableDragging();
    GEvent.bind(gmap, "click", this, this.startMove);
}

ZoneCircle.prototype.startMove = function(e, latlng) {
    this._dragStart = latlng;
    GEvent.clearListeners(gmap);
    GEvent.bind(gmap, "click", this, this.setPosition);
    GEvent.bind(gmap, "mousemove", this, this.dragPosition);
    setInstructions("Drag to position, click to set");
}

ZoneCircle.prototype.dragPosition = function(latlng) {
    var offsetLat = latlng.lat() - this._dragStart.lat();
    var offsetLng = latlng.lng() - this._dragStart.lng();
    
    this.center = new GLatLng(this.center.lat() + offsetLat, this.center.lng() + offsetLng);
    this.redraw(true);

    this._dragStart = latlng;

    propBox.updateValue(this, 'lat', this.center.lat().toFixed(LATLNG_PRECISION));
    propBox.updateValue(this, 'lng', this.center.lng().toFixed(LATLNG_PRECISION));

}

ZoneCircle.prototype.setPosition = function(e, latlng) {
    this._changed = true;
    GEvent.clearListeners(gmap);
    gmap.enableDragging();
    setInstructions("");
}

ZoneCircle.prototype.setColor = function(color) {
    this.color = color;
    if (this._circle) {
        this._circle.setAttribute("fill", color);
    }
}

ZoneCircle.prototype.highlight = function(yes) {
    var color;

    if (!this._link) {
        this.createZoneListEntry();
    }

    if (yes) {
        this._circle.setAttribute("fill", "#9f9");
        this._link.style.color = "#090";
    } else { 
        this._circle.setAttribute("fill", "#99f");
        this._link.style.color = "blue";
    }
}

ZoneCircle.prototype.getEditableFieldDict = function() {
    
    var edge = new GLatLng(this.center.lat(), this.center.lng() + this.radius);
    var dist = Math.round(this.center.distanceFrom(edge));
    
    return [
        'name', this.name,
        'lat', this.center.lat().toFixed(LATLNG_PRECISION),
        'lng', this.center.lng().toFixed(LATLNG_PRECISION),
        'radius', dist
    ];
}

ZoneCircle.prototype.setValue = function(field, value) {
    if (field == "name") {
        if (this.name != value) {
            this.name = value;
            this._link.innerHTML = value;
        }
    } else if (field == "lat") {
        value = parseFloat(value, 10);
        this.center = new GLatLng(value, this.center.lng());
    } else if (field == "lng") {
        value = parseFloat(value, 10);
        this.center = new GLatLng(this.center.lat(), value);
    } else if (field == "radius") {
        value = parseFloat(value, 10);
        this.radius = this.radiusFromMeters(value);
    }
}

ZoneCircle.prototype.radiusFromMeters = function(meters) {
    var refEdge = new GLatLng(this.center.lat(), this.center.lng() + 0.01);
    var refMeters = this.center.distanceFrom(refEdge);
    var ratio = meters / refMeters;
    return ratio * 0.01;
}

ZoneCircle.prototype.saveFinished = function() {
    this._changed = true;
    this.redraw(true);
}

ZoneCircle.prototype.getJsonObj = function() {
    var edge = new GLatLng(this.center.lat(), this.center.lng() + this.radius);
    var radius = Math.round(this.center.distanceFrom(edge));

    var obj = {
        'name': this.name,
        'lat': this.center.lat(),
        'lon': this.center.lng(),
        'radius': radius
    };

    if (this._dbid != undefined) obj.id = this._dbid;

    return obj;
}


/** GOverlay callbacks **/

ZoneCircle.prototype.initialize = function(map, opacity) {

    if (!this.opacity) this.opacity = "0.5";

    this._map = map;

    var svgRoot = document.createElementNS(SVG_NS, "svg");
    this._svgRoot = svgRoot;
	svgRoot.setAttribute("id", "customSvgRoot");
    svgRoot.style.position = "absolute";

    var circle = document.createElementNS(SVG_NS, "circle");
    this._circle = circle;

    circle.setAttribute("stroke", "black");
    circle.setAttribute("stroke-width", 2);
    circle.setAttribute("fill", this.color);
    circle.setAttribute("fill-opacity", this.opacity);
    
    var self = this;
    circle.addEventListener("click", function() { setHighlight([self]); }, false);

    var point = document.createElementNS(SVG_NS, "circle");
    this._point = point;
    point.setAttribute("fill", "black");
    point.setAttribute("r", "2");

    svgRoot.appendChild(this._circle);
    svgRoot.appendChild(point);

    this.redraw(true);

}

ZoneCircle.prototype.remove = function() {
    this._map.getPane(G_MAP_MAP_PANE).removeChild(this._svgRoot);
    propBox.clearIfActive(this);
    zoneList.removeZone(this);
    deletedObjs.push({id: this._dbid});
}

ZoneCircle.prototype.copy = function() {
    return new ZoneCircle(this.center, this.radius);
}

ZoneCircle.prototype.redraw = function(force) {

    // We only need to redraw if the coordinate system has changed
    if (!force) return;

    var svgRoot = this._svgRoot;

    try {
        this._map.getPane(G_MAP_MAP_PANE).removeChild(svgRoot);
    } catch (e) {}

    var point = this._map.fromLatLngToDivPixel(this.center);
   
    var pixRadius;
    if (this.pixRadius) {
        pixRadius = this.pixRadius;
    } else {
        var edge = new GLatLng(this.center.lat(), this.center.lng() + this.radius);
        var edgePoint = this._map.fromLatLngToDivPixel(edge);
        pixRadius = Math.abs(edgePoint.x - point.x);
    }
    
    // We give the size a bit of padding for the stroke.
    var size = (pixRadius * 2) + 10;
    var halfSize = size / 2;

    svgRoot.style.left = (point.x - halfSize) + "px";
    svgRoot.style.top = (point.y - halfSize) + "px";

	svgRoot.setAttribute("viewBox", "0 0 " + size + " " + size);
	svgRoot.setAttribute("width", "" + size);
	svgRoot.setAttribute("height", "" + size);

    var circle = this._circle;
    circle.setAttribute("cx", halfSize);
    circle.setAttribute("cy", halfSize);
    circle.setAttribute("r", pixRadius);

    this._point.setAttribute("cx", halfSize);
    this._point.setAttribute("cy", halfSize);

    this._map.getPane(G_MAP_MAP_PANE).appendChild(svgRoot);

}