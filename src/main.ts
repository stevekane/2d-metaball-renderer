import { randInt } from './utils/random'
import { wrap } from './utils/range'

const SPHERE_COUNT = 100
const AREA = [ 800, 450 ]

const radii = new Float32Array(SPHERE_COUNT)
const positions = new Float32Array(2 * SPHERE_COUNT)
const velocities = new Float32Array(2 * SPHERE_COUNT)
const settings = {
  K: 0.1,
  color: [ .2, .4, .8 ]
}

for ( var i = 0; i < SPHERE_COUNT; i++ ) {
  radii[i] = randInt(4, 30)
  positions[i * 2] = randInt(0, AREA[0])
  positions[i * 2 + 1] = randInt(0, AREA[1])
  velocities[i * 2] = randInt(-4, 4)
  velocities[i * 2 + 1] = randInt(-4, 4)
}

const vsrc = 
`
precision mediump float;

attribute vec2 a_vertices;

void main () {
  gl_Position = vec4(a_vertices, 1.0, 1.0);
}
`

const fsrc =
`
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_K;
uniform vec3 u_color;
uniform float u_radii [ ${ SPHERE_COUNT } ];
uniform vec2 u_positions [ ${ SPHERE_COUNT } ];

float sdf_sphere ( float r, vec2 c, vec2 p ) {
  return distance(p, c) - r;
}

void main () {
  vec2 p = gl_FragCoord.xy;
  float dist = 0.;

  for ( int i = 0; i < ${ SPHERE_COUNT }; i++ ) {
    dist += exp(-u_K * sdf_sphere(u_radii[i], u_positions[i], p));
  }
  dist = -log(dist) / u_K;
  float opacity = clamp(.5 - dist, 0.0, 1.0);

  gl_FragColor = vec4(u_color, opacity);
}
`

const canvas = document.createElement('canvas')
const slider = document.createElement('input')
const gl = canvas.getContext('webgl')

if ( gl == null ) {
  throw new Error('gl context could not be obtained')
}

const vertex = gl.createShader(gl.VERTEX_SHADER)
const fragment = gl.createShader(gl.FRAGMENT_SHADER)
const program = gl.createProgram()
const screenQuad = new Float32Array([
  -1, 1, -1, -1, 1, -1,
  -1, 1, 1, -1, 1, 1
]) 
const quadSize = screenQuad.length / 2 

if ( vertex == null && fragment == null && program == null ) {
  throw new Error('gl resources could not be obtained')
}

gl.shaderSource(vertex, vsrc)
gl.compileShader(vertex)
gl.shaderSource(fragment, fsrc)
gl.compileShader(fragment)

gl.attachShader(program, vertex)
gl.attachShader(program, fragment)
gl.linkProgram(program)
gl.useProgram(program)

if ( !gl.getProgramParameter(program, gl.LINK_STATUS) ) {
  console.log(gl.getShaderInfoLog(vertex))
  console.log(gl.getShaderInfoLog(fragment))
  console.log(gl.getProgramInfoLog(program))
}

const verticesBuffer = gl.createBuffer()
const a_locations = {
  a_vertices: gl.getAttribLocation(program, 'a_vertices')
}
const u_locations = {
  u_K: gl.getUniformLocation(program, 'u_K') as WebGLUniformLocation,
  u_color: gl.getUniformLocation(program, 'u_color') as WebGLUniformLocation,
  u_time: gl.getUniformLocation(program, 'u_time') as WebGLUniformLocation,
  u_resolution: gl.getUniformLocation(program, 'u_resolution') as WebGLUniformLocation,
  u_radii: gl.getUniformLocation(program, 'u_radii') as WebGLUniformLocation,
  u_positions: gl.getUniformLocation(program, 'u_positions') as WebGLUniformLocation
}

gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer)
gl.enableVertexAttribArray(a_locations.a_vertices)
gl.vertexAttribPointer(a_locations.a_vertices, 2, gl.FLOAT, false, 0, 0)
gl.bufferData(gl.ARRAY_BUFFER, screenQuad, gl.STATIC_DRAW)

slider.type = 'range'
slider.min = '0'
slider.max = '0.1'
slider.step = '0.01'
slider.value = settings.K.toString()
slider.addEventListener('input', _ => settings.K = Number(slider.value))

canvas.width = AREA[0]
canvas.height = AREA[1]
canvas.style.boxSizing = 'border-box'
canvas.style.border = '2px solid Coral'
document.body.style.margin = '0',
document.body.style.backgroundColor = 'MistyRose'
document.body.appendChild(canvas)
document.body.appendChild(slider)

gl.viewport(0, 0, AREA[0], AREA[1])
gl.enable(gl.CULL_FACE)
gl.clearColor(0, 0, 0, 0)
gl.useProgram(program)

const start = Date.now()
const raf = window.requestAnimationFrame

raf(function render() {
  const time = Date.now()
  const buffer = 1.05

  if ( time - start > 1000 ) {
    for ( var i = 0; i < 2 * SPHERE_COUNT; i += 2 ) {
      positions[i] = wrap(-AREA[0] * buffer, AREA[0] * buffer, positions[i] + velocities[i])
      positions[i + 1] = wrap(-AREA[1] * buffer, AREA[1] * buffer, positions[i + 1]+ velocities[i + 1])
    }
  }
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.uniform1f(u_locations.u_time, time)
  gl.uniform2f(u_locations.u_resolution, AREA[0], AREA[1])
  gl.uniform1f(u_locations.u_K, settings.K)
  gl.uniform3f(u_locations.u_color, settings.color[0], settings.color[1], settings.color[2])
  gl.uniform1fv(u_locations.u_radii, radii)
  gl.uniform2fv(u_locations.u_positions, positions)
  gl.drawArrays(gl.TRIANGLES, 0, quadSize)
  raf(render)
})

window.addEventListener('error', (e: any) => alert(e.message))
