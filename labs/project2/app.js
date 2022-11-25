import { buildProgramFromSources, loadShadersFromURLS, setupWebGL} from "../../libs/utils.js";
import { ortho, lookAt, flatten, rotateY, vec3 } from "../../libs/MV.js";
import {modelView, loadMatrix, multRotationY, multRotationX, multRotationZ, multScale, pushMatrix, popMatrix, multTranslation } from "../../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js';
import * as CUBE from '../../libs/objects/cube.js';
import * as PYRAMID from '../../libs/objects/pyramid.js';
import * as CYLINDER from '../../libs/objects/cylinder.js';
import * as TORUS from '../../libs/objects/torus.js';

/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1/60.0;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

let altitude = 0;
let inclination = 0;
let movingfoward = false;
let dropped_box = false;
let box_rotation = 0;
let heliRotation = 0;
let box_pos = 0; //NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN
let box_speed = 0;


const FLOOR_LENGTH = 500;
const FLOOR_COLOR = vec3(0.1, 0.1, 0.1);
const VP_DISTANCE = FLOOR_LENGTH/4;

//heli flight parameters
const MAX_INCLINATION = 30;
const MAX_FLIGT_HEIGHT = 200;
const FLIGHT_SPEED = 1;
const FLIGHT_RADIUS = 30/2;
const INCLINATION_SPEED = 0.25;
const PROPELLER_SPEED = 500;

//heli size and color parameters
const HELI_SIZE_MULT = 6;
const PROPELLER_LENGTH = 4;
const PROPELLER_COLOR =  vec3(0.4, 0.5, 0.4);
const ROTOR_LENGHT = 0.75;
const ROTOR_COLOR =  vec3(0.4, 0.5, 0.4);
const COWLING_COLOR = vec3(0.2, 0.2, 0.1);
const COCKPIT_DIAMETER = 3;
const COCKPIT_COLOR = vec3(0.2, 0.2, 0.1);
const TAIL_DIAMETER = 6.5;
const TAIL_COLOR =  vec3(0.4, 0.5, 0.4);
//const FIN_DIAMETER = 2;
const FIN_COLOR = vec3(0.2, 0.2, 0.1);
const FEET_LENGTH = 2.5;
const FEET_DISTANCE = 1;
const FEET_COLOR = vec3(0.4, 0.5, 0.4);

//box dimensions parameters
const BOX_LENGHT = 5;



function setup(shaders)
{
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);

    mode = gl.TRIANGLES; //starting mode

    const uColor = gl.getUniformLocation(program, "uColor"); //color

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onkeydown = function(event) {
        switch(event.key) {
            case 'w':
                mode = gl.LINES; 
                break;
            case 's':
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
                    altitude = altitude + 2;
                }
                break;
            case 'ArrowDown':
                if(altitude > 2){
                    altitude = altitude - 2;
                }else if(altitude == 2 && inclination == 0){
                    altitude = altitude - 2;
                }
                break;
            case 'ArrowLeft':
                if(altitude > 0 && inclination < MAX_INCLINATION){
                    //inclination = inclination + 0.5;
                    movingfoward = true;
                }
                break;
            case ' ':
                if(altitude > 1)
                dropped_box = true;
                box_rotation = heliRotation;
                box_speed = inclination;
                break;
        }
    }

    document.onkeyup = function(event) {
        switch(event.key) {
            case 'ArrowLeft':
                movingfoward = false;
                break;

            case ' ':
                dropped_box = false;
                break;
        }
    }
    
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    SPHERE.init(gl);
    CUBE.init(gl);
    PYRAMID.init(gl);
    CYLINDER.init(gl);
    TORUS.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);


    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }


    function Ground()
    {
        multScale([FLOOR_LENGTH, FLOOR_LENGTH/10, FLOOR_LENGTH]);
        multTranslation([0, -FLOOR_LENGTH/(FLOOR_LENGTH*2), 0]);

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        CUBE.draw(gl, program, mode);
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
        CUBE.draw(gl, program, mode);
    }
   
    function Helicopter(){
        
        pushMatrix();//---top propellers---
            gl.uniform3fv(uColor, PROPELLER_COLOR);
            multTranslation([0.5, 4, 0]);
            if(altitude != 0){
                multRotationY(time*PROPELLER_SPEED);
            }
            Propellers(); 
        popMatrix();
        pushMatrix();//-----top rotor------
            gl.uniform3fv(uColor, ROTOR_COLOR);
            multTranslation([0.5, 3.75, 0]);
            if(altitude != 0){
                multRotationY(time*PROPELLER_SPEED);
            }
            Top_Rotor();
        popMatrix();
        pushMatrix();//-----cowling--------
            gl.uniform3fv(uColor, COWLING_COLOR);
            multTranslation([0.5, 2.75, 0]);
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
            if(altitude != 0){
                multRotationY(-time*PROPELLER_SPEED);
            }
            Tail_Rotor();
        popMatrix();
        pushMatrix();//--tail proppelers--
            gl.uniform3fv(uColor, PROPELLER_COLOR);
            multTranslation([6.975, 2.4, 0.2]);
            multScale([0.25, 0.25, 0.25]);
            multRotationX(90);
            if(altitude != 0){
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
        // pushMatrix();//teste comprimento 10
        //     multTranslation([2.75, 0, 0]);
        //     teste();
        // popMatrix(); 
        
    }

    // function teste(){
    //     multScale([10, 5, 5]);
        
    //     // Send the current modelview matrix to the vertex shader
    //     uploadModelView();
    //     CUBE.draw(gl, program, mode);
    // }

    
    function World(){
        multRotationY(30);
        pushMatrix();//--world floor----
        gl.uniform3fv(uColor, FLOOR_COLOR);
            Ground();
        popMatrix();
        pushMatrix();//------heli-------
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
        
        //if(dropped_box){
            box_pos = box_pos + box_speed/40 * FLIGHT_SPEED;
            multRotationY(box_rotation);
            //multRotationX(Math.cos(heliRotation));
            //multRotationZ(-Math.sin(heliRotation));
            console.log(box_pos);
            let x = Math.cos(box_rotation)*box_pos;
            let z = -Math.sin(box_rotation)*box_pos;
            multTranslation([x, altitude, z]);
            
            //multTranslation([Math.cos(heliRotation), 0, -Math.sin(heliRotation)]);
            multRotationY(-90);
            Box();
        ///}
        
        // angulo * velocidade_angular = speed
        // speed*(cos(angulo), -sin(angulo))
    }

    function render()
    {
        if(animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
    
        loadMatrix(lookAt([0,VP_DISTANCE,VP_DISTANCE], [0,0,0], [0,1,0]));

        World();
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))