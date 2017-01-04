/// <reference path="../typings/index.d.ts" />

import { randInt, randNum } from './utils/random'
import { wrap } from './utils/range'

const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl')

if ( gl == null ) {
  throw new Error('gl context could not be obtained')
}

if ( gl.getExtension('OES_texture_float') == null ) {
  throw new Error('FLOAT Texture extension not available') 
}

const settings = {
  K: 0.2,
  G: 980, 
  R: .2,
  color: [ .2, .4, .8 ],
}
const COUNT = 2048
const positions = new Float32Array(COUNT * 4)
const velocities = new Float32Array(COUNT * 4)
const AREA_X = 400
const AREA_Y = 400
const BUCKET_X = 32
const BUCKET_Y = 32
const BUCKET_COUNT = BUCKET_X * BUCKET_Y
const MAX_PARTICLES_PER_BUCKET = 64
const activeIndices = new Int32Array(BUCKET_COUNT)
const pSorted = new Float32Array(BUCKET_COUNT * MAX_PARTICLES_PER_BUCKET * 4)

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

uniform float u_time;
uniform float u_K;
uniform float u_R;
uniform vec3 u_color;
uniform float u_bucket;
uniform sampler2D u_positions;

const float DX = 1. / ${ MAX_PARTICLES_PER_BUCKET }.;
const float DY = 1. / ${ BUCKET_COUNT }.;
const float BUCKET_X = ${ BUCKET_X }.;
const float BUCKET_Y = ${ BUCKET_Y }.;
const float AREA_X = ${ AREA_X }.;
const float AREA_Y = ${ AREA_Y }.;

float sdf_sphere ( float r, vec2 c, vec2 p ) {
  return distance(p, c) - r;
}

float to_bucket_index ( vec2 p ) {
  return floor(max(0., p.x / (AREA_X / BUCKET_X))) +
         floor(max(0., p.y / (AREA_Y / BUCKET_Y))) * BUCKET_Y;
}

void main () {
  vec2 p = gl_FragCoord.xy;
  vec2 pos;
  vec2 tex_coord;
  vec4 particle;
  float bucket_index = to_bucket_index(p);
  float weight = 0.;
  float dist = 0.;

  for ( float i = 0.; i < 1.; i += DX ) {
    tex_coord.x = i;
    tex_coord.y = bucket_index * DY;
    particle = texture2D(u_positions, tex_coord);
    pos = particle.xy;
    weight = particle.w;
    dist += weight * exp(-u_K * sdf_sphere(u_R, pos, p));
  }
  dist = log(dist) / u_K;
  float opacity = step(0., dist);
  gl_FragColor = vec4(u_color, opacity);
}
`

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
  u_R: gl.getUniformLocation(program, 'u_R') as WebGLUniformLocation,
  u_color: gl.getUniformLocation(program, 'u_color') as WebGLUniformLocation,
  u_time: gl.getUniformLocation(program, 'u_time') as WebGLUniformLocation,
  u_positions: gl.getUniformLocation(program, 'u_positions') as WebGLUniformLocation,
  u_bucket: gl.getUniformLocation(program, 'u_bucket') as WebGLUniformLocation
}
const ps = gl.createTexture()

gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer)
gl.enableVertexAttribArray(a_locations.a_vertices)
gl.vertexAttribPointer(a_locations.a_vertices, 2, gl.FLOAT, false, 0, 0)
gl.bufferData(gl.ARRAY_BUFFER, screenQuad, gl.STATIC_DRAW)

gl.activeTexture(gl.TEXTURE0)
gl.bindTexture(gl.TEXTURE_2D, ps)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, MAX_PARTICLES_PER_BUCKET, BUCKET_COUNT, 0, gl.RGBA, gl.FLOAT, pSorted)

canvas.width = AREA_X
canvas.height = AREA_Y
canvas.style.boxSizing = 'border-box'
canvas.style.border = '2px solid Coral'
document.body.style.margin = '0'
document.body.style.backgroundColor = 'MistyRose'
document.body.appendChild(canvas)

gl.viewport(0, 0, AREA_X, AREA_Y)
gl.enable(gl.CULL_FACE)
gl.disable(gl.DEPTH_TEST)
// gl.enable(gl.BLEND)
// gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
gl.clearColor(0, 0, 0, 0)
gl.useProgram(program)

const raf = window.requestAnimationFrame
const clock = { then: Date.now(), now: Date.now() }

for ( var i = 0; i < positions.length; i += 4 ) {
  positions[i] = randNum(0, 400)
  positions[i + 1] = randNum(0, 100) 
  velocities[i] = randNum(-300, 300)
  velocities[i + 1] = randNum(100, 600)
}

// TODO: uses globals for simplicity atm
function getBucketIndex ( x: number, y: number ): number {
  if      ( x < 0 || y > AREA_X ) return -1
  else if ( y < 0 || y > AREA_Y ) return -1
  else                            return Math.floor(Math.max(0, x / (AREA_X / BUCKET_X))) +
                                         Math.floor(Math.max(0, y / (AREA_Y / BUCKET_Y))) * BUCKET_Y
}

function printSorted ( s: Float32Array ) {
  var msg = ''

  for ( var i = 0; i < s.length / 4; i++ ) {
    var w = s[i * 4 + 3]
    var nl = i % MAX_PARTICLES_PER_BUCKET == 0

    msg += nl ? '\n' : ''
    msg += w
  }
  console.log(msg)
}

raf(function render() {
  clock.then = clock.now
  clock.now = Date.now()

  activeIndices.fill(0)
  pSorted.fill(0)

  for ( var i = 0, G = -settings.G, dT = 0.01; i < positions.length; i += 4 ) {
    if ( positions[ i + 1 ] < Math.random() * -100 ) {
      velocities[i + 1] = randNum(600, 900)
      positions[i] = AREA_X / 2
      positions[i + 1] = 0
    }
    else {
      velocities[i + 1] += dT * G
      positions[i] += dT * velocities[i]
      positions[i + 1] += dT * velocities[i + 1]
    }
    var px = positions[i]
    var py = positions[i + 1]
    var bIndex = getBucketIndex(px, py)

    if ( bIndex == -1 ) continue

    for ( var k = -1; k <= 1; k++ ) {
      for ( var l = -1; l <= 1; l++ ) {
        var index = bIndex - l - k * BUCKET_X
        var aIndex = activeIndices[index]

        if ( aIndex == null ) continue

        var bStart = index * MAX_PARTICLES_PER_BUCKET * 4
        var aOffset = aIndex * 4
        var sIndex = bStart + aOffset

        pSorted[sIndex] = px
        pSorted[sIndex + 1] = py
        pSorted[sIndex + 3] = 1
        activeIndices[index] = Math.min(aIndex + 1, MAX_PARTICLES_PER_BUCKET - 1)
      }
    }
  }
  
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.uniform1f(u_locations.u_time, clock.now)
  gl.uniform1f(u_locations.u_K, settings.K)
  gl.uniform1f(u_locations.u_R, settings.R)
  gl.uniform3f(u_locations.u_color, settings.color[0], settings.color[1], settings.color[2])
  gl.uniform1i(u_locations.u_positions, 0)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, MAX_PARTICLES_PER_BUCKET, BUCKET_COUNT, 0, gl.RGBA, gl.FLOAT, pSorted)
  gl.drawArrays(gl.TRIANGLES, 0, quadSize)
  raf(render)
})
