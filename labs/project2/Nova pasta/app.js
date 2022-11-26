import { loadShadersFromURLS,setupWebGL, buildProgramFromSources } from "../../libs/utils.js";
import {mat4, vec3, flatten, lookAt, ortho,mult,translate,rotateZ,rotateX,rotateY,scalem} from "../../libs/MV.js";
import {modelView,loadMatrix,multRotationX,multRotationZ,multRotationY,multScale,multTranslation,popMatrix,pushMatrix} from "../../libs/stack.js";

import * as SPHERE from "../../libs/objects/sphere.js";
import * as CUBE from "../../libs/objects/cube.js";
import * as CYLINDER from "../../libs/objects/cylinder.js";
import * as PYRAMID from '../../libs/objects/pyramid.js';
import * as TORUS from '../../libs/objects/torus.js';
import * as dat from "../../libs/dat.gui.module.js";

/** @type {WebGlRenderingContext} */
var gl;
var program;

let mProjection;
let mView;
let mode;
let canvas;
var aspect;
var zoom;
var floorHeigth = -1;

var timer;
var semaphoreColorIdx = 1;
var semaphoreColor1 = 1;
var semaphoreColor2 = 0;
var semaphoreColor3 = 0;

let teta = 0.5;
let gamma = 0.5;
       
let time = 0;           // Global simulation time in days
let speed = 1/60.0;     // Speed (how many days added to time on each render pass
let animation = true;   // Animation is running

let color;
let altitude = 0;
let inclination = 0;
let movingfoward = false;
let dropped_box = false;
let box_rotation = 0;
let heliRotation = 0;
let box_pos = 0;
let box_speed = 0;
let box_altitude = 0;
let box_falling_timer = 0;
let previousMode = 1;

const FLOOR_LENGTH = 500;
const FLOOR_COLOR = vec3(0.1, 0.1, 0.1);
const VP_DISTANCE = FLOOR_LENGTH/4;

//heli flight parameters
const MAX_INCLINATION = 30;
const MAX_FLIGT_HEIGHT = 20;
const FLIGHT_SPEED = 2.5;
const FLIGHT_RADIUS = 30/2;
const INCLINATION_SPEED = 0.75;
const PROPELLER_SPEED = 1200;
const HELI_ALTITUDE_SPEED = 2;

//heli size and color parameters
const HELI_SIZE_MULT = 0.1;
const PROPELLER_LENGTH = 4;
const PROPELLER_COLOR =  vec3(0.4, 0.5, 0.4);
const ROTOR_LENGHT = 0.75;
const ROTOR_COLOR =  vec3(0.4, 0.5, 0.4);
const COWLING_COLOR = vec3(0.2, 0.2, 0.1);
const COCKPIT_DIAMETER = 3;
const COCKPIT_COLOR = vec3(0.2, 0.2, 0.1);
const TAIL_DIAMETER = 6.5;
const TAIL_COLOR =  vec3(0.4, 0.5, 0.4);
const FIN_COLOR = vec3(0.2, 0.2, 0.1);
const FEET_LENGTH = 2.5;
const FEET_DISTANCE = 1;
const FEET_COLOR = vec3(0.4, 0.5, 0.4);

//box dimensions parameters
const BOX_LENGHT = 0.1;
const BOX_FALLING_SPEED = 0.2;
const BOX_FRICTION_SPEED = 0.6;

const edge = 2.0;

window.addEventListener("keydown", function (event) {
  switch (event.key) {
    case "w":
      mode = gl.LINES;
      break;
    case "s":
      mode = gl.TRIANGLES;
      break;
    case 'p':
        animation = !animation;
        break;
    case '+':
        if(animation) speed *= 1.1;
        break;
    case '-':
        if(animation) speed /= 1.1;
        break;
        case 'ArrowUp':
          if(altitude<MAX_FLIGT_HEIGHT){
              altitude = altitude + HELI_ALTITUDE_SPEED;
          }
          break;
      case 'ArrowDown':
         if(altitude >0 && inclination <= 0){
              altitude = altitude - HELI_ALTITUDE_SPEED;
          } else if(altitude > -13 && (previousMode == 2 || previousMode == 4)){
            altitude = altitude - HELI_ALTITUDE_SPEED;
          }
          break;
    case 'ArrowLeft':
        if(altitude > 0 && inclination < MAX_INCLINATION){
            movingfoward = true;
        } else if(altitude > -13 && (previousMode == 2 || previousMode == 4)){
          movingfoward = true;
        }
        break;
    case ' ':
          if(altitude > 1 || (altitude > -13 && (previousMode == 2 || previousMode == 4))){
            box_falling_timer = 0;
            box_pos = 0;
            box_altitude = altitude;
            dropped_box = true;
            box_rotation = heliRotation;
            box_speed = inclination;
          }
          break;
    case "1":
      floorHeigth = -1;
      calculateNewAltitude(1);
      previousMode = 1;
      mView = lookAt([2, 1.2, 1], [0, 0.6, 0], [0, 1, 0]);
      break;
    case "2":
      // Front view
      floorHeigth = -7;
      calculateNewAltitude(2);
      previousMode = 2;
      mView = lookAt([0, 0, 1], [0, 0, 0], [0, 1, 0]);
      break;
    case "3":
      // Top view
      floorHeigth = -1;
      calculateNewAltitude(3);
      previousMode = 3;
      mView = lookAt([0, 1.6, 0], [0, 0.6, 0], [0, 0, -1]);
      break;
    case "4":
      // Right view
      floorHeigth = -7;
      calculateNewAltitude(4);
      previousMode = 4;
      mView = lookAt([1, 0, 1], [0, 0, 0], [0, 1, 0]);
      break;
  }
});

function calculateNewAltitude(newMode){
  if((previousMode == 1 || previousMode == 3) && (newMode != 1 && newMode != 3)){
    altitude -= 13;
    if(dropped_box) box_altitude -= 12;
  } else if((previousMode == 2 || previousMode == 4) && (newMode != 2 && newMode != 4)){
    altitude += 13;
    if(dropped_box) box_altitude += 12;
  }
}

document.onkeyup = function(event) {
  switch(event.key) {
      case 'ArrowLeft':
          movingfoward = false;
          break;
  }
}

function setup(shaders) {
  // Setup
  canvas = document.getElementById("gl-canvas");
  gl = setupWebGL(canvas);
  gl.enable(gl.DEPTH_TEST);

  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = window.innerHeight;

  aspect = canvas.width / canvas.height;

  resize_canvas();
  window.addEventListener("resize", resize_canvas);

  program = buildProgramFromSources(gl,shaders["shader.vert"],shaders["shader.frag"]);

  var gui = new dat.GUI({ name: "My GUI" });
  gui.addFolder("Axonometric Projection Values");
  var person = { teta, gamma };
  var slider1 = gui.add(person, "teta", 0, 1);
  var slider2 = gui.add(person, "gamma", 0, 1);

  slider1.onChange(function (value) {
    teta = value * 360;
    floorHeigth = -7;
    calculateNewAltitude(2);
    previousMode = 2;
    mView = mult(lookAt([0, 0, 1], [0, 0, 0], [0, 1, 0]),mult(rotateY(gamma), rotateY(teta)));
  });

  slider2.onChange(function (value) {
    gamma = value * 360;
    floorHeigth = -7;
    calculateNewAltitude(2);
    previousMode = 2;
    mView = mult(lookAt([0, 0, 1], [0, 0, 0], [0, 1, 0]),mult(rotateX(gamma), rotateX(teta)));
  });

  mView = lookAt([2, 1.2, 1], [0, 0.6, 0], [0, 1, 0]);
  setupProjection();

  SPHERE.init(gl);
  CUBE.init(gl);
  CYLINDER.init(gl);
  PYRAMID.init(gl);
  TORUS.init(gl);

  mode = gl.TRIANGLES;

  function setupProjection() {
    if (canvas.width < canvas.height) {
      const yLim = (edge * canvas.height) / canvas.width;
      mProjection = ortho(-edge, edge, -yLim, yLim, -10, 10);
    } else {
      const xLim = (edge * canvas.width) / canvas.height;
      mProjection = ortho(-xLim, xLim, -edge, edge, -10, 10);
    }
  }

  window.addEventListener("resize", function () {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = window.innerHeight;

    setupProjection();

    gl.viewport(0, 0, canvas.width, canvas.height);
  });

  // Setup the viewport
  gl.viewport(0, 0, canvas.width, canvas.height);

  // Setup the background color
  gl.clearColor(0.302, 0.426, 1.0, 1.0);

  // Call animate for the first time
  window.requestAnimationFrame(animate);

  changeSemaphoreColor();
}

function resize_canvas(event) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  aspect = canvas.width / canvas.height;

  gl.viewport(0, 0, canvas.width, canvas.height);
  mProjection = ortho(-aspect * zoom, aspect * zoom, -zoom, zoom, 0.01, 3);
}

function uploadModelView() {
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"),false,flatten(modelView()) );
}

function applyColor(color1, color2, color3, primitive){
  color = gl.getUniformLocation(program, "color");
  gl.uniform3f(color, color1, color2, color3);
  primitive.draw(gl, program, mode);
}

function Floor() {

  multScale([5, 0.2, 5]);
  multRotationY(100);
  multTranslation([0, floorHeigth, 0]);

  uploadModelView();

  applyColor(0.267, 0.267, 0.267, CUBE);
}

function addWay1() {
  multScale([1, 0.1, 0.1]);
  multTranslation([0, 5.5, 1]);

  uploadModelView();

  applyColor(0.145, 0.145, 0.145, CUBE);

  multRotationY(90);

  let inc = 1.5;
  let init = -7;

  for (let i = 0; i < 8; i++) {
    pushMatrix();
    multScale([0.03, 0.5, 0.08]);
    init += inc;
    multTranslation([-2, 1, init]);

    uploadModelView();
    applyColor(0.416, 0.416, 0.416,CUBE);

    popMatrix();
  }
}

function addWay2() {
  multScale([0.5, 0.1, 0.1]);
  multTranslation([0, 5.5, -3]);

  uploadModelView();

  applyColor(0.145, 0.145, 0.145, CUBE);
  multRotationY(90);

  let inc = 2.0;
  let init = -5;

  for (let i = 0; i < 5; i++) {
    pushMatrix();
    multScale([0.03, 0.5, 0.08]);
    init += inc;
    multTranslation([-2, 1, init]);

    uploadModelView();

    applyColor(0.416, 0.416, 0.416,CUBE);

    popMatrix();
  }
}

function addWay3() {
  multScale([0.1, 0.1, 0.65]);
  multTranslation([-2, 5.5, -0.27]);

  uploadModelView();

  applyColor(0.145, 0.145, 0.145,CUBE);

  let inc = 2.0;
  let init = -7;

  for (let i = 0; i < 5; i++) {
    pushMatrix();
    multScale([0.03, 0.5, 0.08]);
    init += inc;
    multTranslation([-2, 1, init]);

    uploadModelView();

    applyColor( 0.416, 0.416, 0.416, CUBE)

    popMatrix();
  }
}

function addWay4() {
  multScale([0.1, 0.1, 0.8]);
  multTranslation([2, 5, 0.124]);

  uploadModelView();
  applyColor(0.145, 0.145, 0.145, CUBE);

  let inc = 2.0;
  let init = -7;

  for (let i = 0; i < 6; i++) {
    pushMatrix();
    multScale([0.03, 0.5, 0.08]);
    init += inc;
    multTranslation([-2, 1, init]);

    uploadModelView();

    applyColor(0.416, 0.416, 0.416, CUBE);

    popMatrix();
  }
}

function addBuilding1() {
  multScale([0.1, 6, 0.1]);
  multTranslation([3.5, 0.5, -3]);

  uploadModelView();
  
  applyColor(0.145, 0.145, 0.145, CUBE);

  let init = 1.2;
  let inc = -1.5;
  let heigth = 3.7;

  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 3; i++) {
      pushMatrix();
      multScale([0.2, 0.1, 0.01]);
      multTranslation([init, heigth, 50]); //z doesnt change!
      init += inc;

      uploadModelView();

      applyColor(0.553, 0.549, 0.22, CUBE);

      popMatrix();
    }

    init = 1.2;
    heigth -= 1.4;
  }

  heigth = 3.7;
  let depth = 1.2;

  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 3; i++) {
      pushMatrix();
      multScale([0.01, 0.1, 0.2]);
      multTranslation([-50, heigth, depth]); //z doesnt change!
      depth -= 1.5;

      uploadModelView();

      applyColor(0.553, 0.549, 0.22, CUBE);

      popMatrix();
    }

    depth = 1.2;
    heigth -= 1.4;
  }
}

function addBuilding2() {
  multScale([0.1, 3, 0.1]);
  multTranslation([-4.5, 0.66, -4.5]);

  uploadModelView();

  applyColor(0.145, 0.145, 0.145, CUBE);

  let init = 1.1;
  let inc = -2.7;
  let heigth = 1.8;

  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 2; i++) {
      pushMatrix();
      multScale([0.2, 0.18, 0.01]);
      multTranslation([init, heigth, 50]); //z doesnt change!
      init += inc;

      uploadModelView();
      
      applyColor(0.553, 0.549, 0.22, CUBE);

      popMatrix();
    }

    init = 1.1;
    heigth -= 2;
  }
}

function addEmpireState() {
  //Base
  multScale([0.12, 5, 0.12]);
  multTranslation([0, 0.6, -0.8]);

  uploadModelView();

  applyColor(0.145, 0.145, 0.145, CUBE);

  let init = 1.1;
  let inc = -2.7;
  let heigth = 1.8;

  //Médio
  pushMatrix();

  multScale([0.8, 0.5, 0.8]);
  multTranslation([0, 1.5, 0]);

  uploadModelView();

  applyColor(0.145, 0.125, 0.145, CUBE);

  //Topo
  pushMatrix();

  multScale([0.8, 1, 0.8]);
  multTranslation([0, 1, 0]);

  uploadModelView();

  applyColor(0.145, 0.105, 0.145, CUBE);

  //Base Ponta
  pushMatrix();

  multScale([0.2, 0.15, 0.2]);
  multTranslation([0, 3.8, 0]);

  uploadModelView();

  applyColor(0.125, 0.105, 0.105, CUBE);

  //Ponta
  pushMatrix();

  multScale([0.4, 4, 0.4]);
  multTranslation([0, 0.6, 0]);

  uploadModelView();

  applyColor(0.145, 0.145, 0.145, CUBE);

  popMatrix();
  popMatrix();

  //Janelas Topo
  init = 1.1;
  inc = -1.5;
  heigth = 2;

  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      pushMatrix();
      multScale([0.18, 0.15, 0.01]);
      multTranslation([init, heigth, 50]);
      init += inc;

      uploadModelView();

      applyColor(0.553, 0.549, 0.22, CUBE);

      popMatrix();
    }

    init = 1.1;
    heigth -= 1.4;
  }

  heigth = 2;
  let depth = 1.2;

  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      pushMatrix();
      multScale([0.01, 0.15, 0.2]);
      multTranslation([-50, heigth, depth]);
      depth -= 1.5;

      uploadModelView();

      applyColor(0.553, 0.549, 0.22, CUBE);

      popMatrix();
    }

    depth = 1.2;
    heigth -= 1.4;
  }

  popMatrix();

  //Janelas Médio
  init = 1.1;
  inc = -1.5;
  heigth = 2;

  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      pushMatrix();
      multScale([0.18, 0.15, 0.01]);
      multTranslation([init, heigth, 50]);
      init += inc;

      uploadModelView();

      applyColor(0.553, 0.549, 0.22, CUBE);

      popMatrix();
    }

    init = 1.1;
    heigth -= 1.4;
  }

  heigth = 2;
  depth = 1.2;

  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      pushMatrix();
      multScale([0.01, 0.15, 0.2]);
      multTranslation([-50, heigth, depth]);
      depth -= 1.5;

      uploadModelView();

      applyColor(0.553, 0.549, 0.22, CUBE);

      popMatrix();
    }

    depth = 1.2;
    heigth -= 1.4;
  }

  popMatrix();

  //Janelas Base
  init = 1.1;
  inc = -1.5;
  heigth = 3;

  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 3; i++) {
      pushMatrix();
      multScale([0.18, 0.12, 0.01]);
      multTranslation([init, heigth, 50]);
      init += inc;

      uploadModelView();

      applyColor(0.553, 0.549, 0.22, CUBE);

      popMatrix();
    }

    init = 1.1;
    heigth -= 1.4;
  }

  heigth = 3;
  depth = 1.2;

  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 3; i++) {
      pushMatrix();
      multScale([0.01, 0.12, 0.2]);
      multTranslation([-50, heigth, depth]);
      depth -= 1.5;

      uploadModelView();

      applyColor(0.553, 0.549, 0.22, CUBE);

      popMatrix();
    }

    depth = 1.2;
    heigth -= 1.4;
  }

  popMatrix();
  popMatrix();
}

function addSemaphores(color1,color2,color3){
  multScale([0.01, 2, 0.01]);
  multTranslation([10, 0.8, 1]);

  uploadModelView();

  applyColor(0.211, 0.211, 0.211, CYLINDER);

  pushMatrix();

  multScale([0.1, 0.1, 5]);
  multTranslation([0, 4.5, 0.5]);

  uploadModelView();

  applyColor(0.211, 0.211, 0.211, CYLINDER);

  pushMatrix();

  multScale([1.2, 1.2, 0.2]);
  multTranslation([-0.2, 0, 0.2]);

  uploadModelView();

  applyColor(color1, color2, color3, SPHERE);

  popMatrix();

  popMatrix();

}

function Propeller()
    {
        multScale([PROPELLER_LENGTH/50, PROPELLER_LENGTH, PROPELLER_LENGTH/5]);

        // Send the current modelview matrix to the vertex shader
        uploadModelView();
        PYRAMID.draw(gl, program, mode);
    }

    function Propellers(){
        multRotationZ(90);
        pushMatrix();
            multTranslation([0, -PROPELLER_LENGTH/2, 0]);
            Propeller();
        popMatrix();
        pushMatrix();
            multTranslation([0, 0, -PROPELLER_LENGTH/2]);
            multRotationX(90);
            Propeller();
        popMatrix();
        pushMatrix();
            multTranslation([0, PROPELLER_LENGTH/2, 0]);
            multRotationX(180);
            Propeller();
        popMatrix();
        pushMatrix();
            multTranslation([0, 0, PROPELLER_LENGTH/2]);
            multRotationX(270);
            Propeller();
        popMatrix();
    }
    
    function Top_Rotor(){
        multScale([ROTOR_LENGHT/4, ROTOR_LENGHT, ROTOR_LENGHT/4]);
        
        // Send the current modelview matrix to the vertex shader
        uploadModelView();
        CYLINDER.draw(gl, program, mode);
    }

    function Cowling(){ //where there top rotor meets the cockpit
        multScale([COCKPIT_DIAMETER/1.5, COCKPIT_DIAMETER/3, COCKPIT_DIAMETER/1.5]);
        multRotationX(90);
        // Send the current modelview matrix to the vertex shader
        uploadModelView();
        TORUS.draw(gl, program, mode);
    }

    function Cockpit(){
        multScale([COCKPIT_DIAMETER*1.5, COCKPIT_DIAMETER, COCKPIT_DIAMETER/1.5]);
        
        // Send the current modelview matrix to the vertex shader
        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function Tail(){
        multScale([TAIL_DIAMETER, TAIL_DIAMETER/10, TAIL_DIAMETER/20]);
        
        // Send the current modelview matrix to the vertex shader
        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function Tail_Rotor(){
        multScale([ROTOR_LENGHT/4, ROTOR_LENGHT/2, ROTOR_LENGHT/4]);
        
        // Send the current modelview matrix to the vertex shader
        uploadModelView();
        CYLINDER.draw(gl, program, mode);
    }

    function Fin(){ // the tipy top of the tail where is the small rotor
        multScale([TAIL_DIAMETER/3, TAIL_DIAMETER/20, TAIL_DIAMETER/40]);
        
        // Send the current modelview matrix to the vertex shader
        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function Support(){ //connect the cockpit to the skids
        multScale([FEET_LENGTH/30, FEET_LENGTH/3.5, FEET_LENGTH/30]);
        // Send the current modelview matrix to the vertex shader
        uploadModelView();
        CYLINDER.draw(gl, program, mode);
    }

    function Supports(){
        pushMatrix();
            multRotationX(20);
            pushMatrix();
                multTranslation([FEET_DISTANCE/1.5, 0, -FEET_DISTANCE]);
                Support();
            popMatrix();
            pushMatrix();
                multTranslation([-FEET_DISTANCE/1.5, 0, -FEET_DISTANCE]);
                Support();
            popMatrix();
        popMatrix();

        pushMatrix();
            multRotationX(-20);
            pushMatrix();
                multTranslation([FEET_DISTANCE/1.5, 0, FEET_DISTANCE]);
                Support();
            popMatrix();
            pushMatrix();
                multTranslation([-FEET_DISTANCE/1.5, 0, FEET_DISTANCE]);
                Support();
            popMatrix();
        popMatrix();
    }

    function Skid(){ //the metal bar that touches the ground (the "foot")
        multScale([FEET_LENGTH/20, FEET_LENGTH, FEET_LENGTH/20]);
        
        // Send the current modelview matrix to the vertex shader
        uploadModelView();
        CYLINDER.draw(gl, program, mode);
    }

    function Skids(){ 
        multRotationZ(90);
        pushMatrix();
            multTranslation([0, 0, FEET_DISTANCE]);
            Skid();
        popMatrix();
        pushMatrix();
            multTranslation([0, 0, -FEET_DISTANCE]);
            Skid();
        popMatrix();
    }

    function Box(){ 
      multScale([BOX_LENGHT, BOX_LENGHT, BOX_LENGHT]);
      // Send the current modelview matrix to the vertex shader
      uploadModelView();
      applyColor(1,1,1,CUBE);
    }
   
    function Helicopter(){

      let uColor = gl.getUniformLocation(program, "color");
        
        pushMatrix();//---top propellers---
            gl.uniform3fv(uColor, PROPELLER_COLOR);
            multTranslation([0.5, 3.75, 0]);
            if(altitude > 0 || (altitude > -13 && previousMode == 2 || previousMode == 4)){
                multRotationY(time*PROPELLER_SPEED);
            }
            Propellers(); 
        popMatrix();
        pushMatrix();//-----top rotor------
            gl.uniform3fv(uColor, ROTOR_COLOR);
            multTranslation([0.5, 3.50, 0]);
            if(altitude > 0 || (altitude > -13 && previousMode == 2 || previousMode == 4)){
                multRotationY(time*PROPELLER_SPEED);
            }
            Top_Rotor();
        popMatrix();
        pushMatrix();//-----cowling--------
            gl.uniform3fv(uColor, COWLING_COLOR);
            multTranslation([0.5, 2.6, 0]);
            Cowling();
        popMatrix();
        pushMatrix();//-----cockpit-------
            gl.uniform3fv(uColor, COCKPIT_COLOR);
            multTranslation([0, 1.5, 0]);
            Cockpit();
        popMatrix();
        pushMatrix();//------tail---------
            gl.uniform3fv(uColor, TAIL_COLOR);
            multTranslation([3.25, 1.75, 0]);
            Tail();
        popMatrix();
        pushMatrix();//---tail rotor------
            gl.uniform3fv(uColor, ROTOR_COLOR);
            multTranslation([6.975, 2.4, 0.1]);
            multRotationX(90);
            if(altitude > 0 || (altitude > -13 && previousMode == 2 || previousMode == 4)){
                multRotationY(-time*PROPELLER_SPEED);
            }
            Tail_Rotor();
        popMatrix();
        pushMatrix();//--tail proppelers--
            gl.uniform3fv(uColor, PROPELLER_COLOR);
            multTranslation([6.975, 2.4, 0.2]);
            multScale([0.25, 0.25, 0.25]);
            multRotationX(90);
            if(altitude > 0 || (altitude > -13 && previousMode == 2 || previousMode == 4)){
                multRotationY(-time*PROPELLER_SPEED);
            }
            Propellers();
        popMatrix();
        pushMatrix();//-------fin---------
            gl.uniform3fv(uColor, FIN_COLOR);
            multTranslation([6.975, 2.4, 0]);
            multRotationZ(45);
            Fin();
        popMatrix();
        pushMatrix();//-----supports------
            gl.uniform3fv(uColor, FEET_COLOR);
            Supports();
        popMatrix();
        pushMatrix();//------skids---------
            gl.uniform3fv(uColor, FEET_COLOR);
            Skids();
        popMatrix(); 
  }

function changeSemaphoreColor() {
    timer = setInterval(function() {
        changeColor();
    }, 5000);
}

function changeColor(){
  var color1 = [1, 0];
  var color2 = [0, 1];
  var color3 = [0, 0];

  semaphoreColor1 = color1[semaphoreColorIdx];
  semaphoreColor2 = color2[semaphoreColorIdx];
  semaphoreColor3 = color3[semaphoreColorIdx];

  semaphoreColorIdx = (semaphoreColorIdx+1) % 2;
}
        

function animate() {
  if(animation) time += speed;
  window.requestAnimationFrame(animate);

  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);

  gl.uniformMatrix4fv(
    gl.getUniformLocation(program, "mProjection"),
    false,
    flatten(mProjection)
  );

  loadMatrix(mView);

  pushMatrix();
  Floor();
  pushMatrix();
  addWay1();
  popMatrix();
  pushMatrix();
  addWay2();
  popMatrix();
  pushMatrix();
  addWay3();
  popMatrix();
  pushMatrix();
  addWay4();
  popMatrix();
  pushMatrix();
  addSemaphores(semaphoreColor1, semaphoreColor2, semaphoreColor3);
  popMatrix();
  pushMatrix();
  addBuilding1();
  popMatrix();
  pushMatrix();
  addBuilding2();
  popMatrix();
  pushMatrix();
  addEmpireState();
  pushMatrix();//-----------------heli----------------------
    multScale([HELI_SIZE_MULT, HELI_SIZE_MULT, HELI_SIZE_MULT]);
    if(altitude != 0){
        if(movingfoward){
            if(inclination < MAX_INCLINATION){
                inclination = inclination + INCLINATION_SPEED;
            }
        }else{
            if(inclination > 0){
            inclination = inclination - INCLINATION_SPEED;
            }
        } 
        heliRotation = heliRotation + inclination/40 * FLIGHT_SPEED;
        multRotationY(heliRotation);
        multTranslation([FLIGHT_RADIUS, altitude, 0]);
        multRotationY(-90);
        multRotationZ(inclination);

    }else{
        multRotationY(heliRotation);
        multTranslation([FLIGHT_RADIUS, 0, 0]);
        multRotationY(-90);
    }
    Helicopter();
  popMatrix();
//---------------box----------------
  if(box_falling_timer>0 && box_falling_timer<5){
    multRotationY(box_rotation);
    if(box_speed > 0)
      box_speed = box_speed - BOX_FRICTION_SPEED;
    else if(box_speed <= 0)
    box_speed = 0;
    box_pos = box_pos + box_speed/1000 * FLIGHT_SPEED;
    multTranslation([(FLIGHT_RADIUS/10), box_altitude/10, 0]);
    
    if(box_altitude > 0 || (box_altitude >= -12.3 && (previousMode == 2 || previousMode == 4))){
      box_altitude = box_altitude - BOX_FALLING_SPEED;
    }
    
    multTranslation([0, 0, -box_pos]);
    multRotationY(-90);
    Box();
  }
  if(dropped_box){
    if(box_falling_timer<5){
      box_falling_timer = box_falling_timer + 1/60.0;
    }
    else{
      dropped_box = false;
    }
  }

}


loadShadersFromURLS(["shader.vert", "shader.frag"]).then((shaders) =>
  setup(shaders)
);
