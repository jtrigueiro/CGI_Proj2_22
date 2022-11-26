uniform mat4 mModelView;
uniform mat4 mProjection;
uniform vec3 color;

attribute vec4 vPosition;
attribute vec3 vNormal;

varying vec3 fNormal;
varying vec3 fColor;

void main() {
    gl_Position = mProjection * mModelView * vPosition;
    fNormal = vNormal;
    fColor = color;
}