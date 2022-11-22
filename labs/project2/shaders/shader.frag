precision highp float;

varying vec3 fNormal;
varying vec3 fColor;

void main() {
    //gl_FragColor = vec4(fNormal, 1.0);
    //gl_FragColor = vec4(0.45, 0.46, 0.47, 1.0);
    gl_FragColor = vec4(fColor, 1.0);
}