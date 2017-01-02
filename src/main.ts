import { randInt, randNum } from './utils/random'
import { wrap } from './utils/range'

const canvas = document.createElement('canvas')
const slider = document.createElement('input')
const gl = canvas.getContext('webgl')

if ( gl == null ) {
  throw new Error('gl context could not be obtained')
}

if ( gl.getExtension('OES_texture_float') == null ) {
  throw new Error('FLOAT Texture extension not available') 
}

const RADIUS = 12
const AREA = [ 800, 450 ]
const SIDE = 16
const bufDimensions = [ SIDE, SIDE ]
const COUNT = bufDimensions[0] * bufDimensions[1]
const positions = new Float32Array(COUNT * 4)
const velocities = new Float32Array(COUNT * 4)

for ( var i = 0; i < positions.length; i += 4 ) {
  positions[i] = AREA[0] / 2
  positions[i + 1] = 0
  velocities[i] = randNum(-300, 300)
  velocities[i + 1] = randNum(100, 600)
}

const settings = {
  K: 0.09,
  G: 980, 
  color: [ .2, .4, .8 ],
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

uniform float u_time;
uniform float u_K;
uniform vec3 u_color;
uniform sampler2D u_positions;

const float RADIUS = ${ RADIUS }.;
const float FRACTION = 1. / ${ SIDE }.;

float sdf_sphere ( float r, vec2 c, vec2 p ) {
  return distance(p, c) - r;
}

void main () {
  vec2 p = gl_FragCoord.xy;
  vec2 pos;
  vec2 tex_coord;
  float dist = 0.;

  for ( float i = 0.; i < 1.; i += FRACTION ) {
    for ( float j = 0.; j < 1.; j += FRACTION ) {
      tex_coord.x = i;
      tex_coord.y = j;
      pos = texture2D(u_positions, tex_coord).xy;
      // THIS IS SLOW because using pos requires the texture read to actually be done
      dist += exp(-u_K * sdf_sphere(RADIUS, pos, p));
    }
    if ( dist >= 1. ) break;
  }
  dist = -log(dist) / u_K;
  float opacity = clamp(.5 - dist, 0.0, 1.0);

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
  u_color: gl.getUniformLocation(program, 'u_color') as WebGLUniformLocation,
  u_time: gl.getUniformLocation(program, 'u_time') as WebGLUniformLocation,
  u_positions: gl.getUniformLocation(program, 'u_positions') as WebGLUniformLocation
}
const ps = gl.createTexture()
// const pfb = gl.createFrameBuffer()

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
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bufDimensions[0], bufDimensions[1], 0, gl.RGBA, gl.FLOAT, positions)
// gl.bindFramebuffer(gl.FRAMEBUFFER, pfb)
// gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ps, 0)

slider.type = 'range'
slider.min = '0'
slider.max = '1000'
slider.step = '50'
slider.value = settings.G.toString()
slider.addEventListener('input', _ => settings.G = Number(slider.value))

canvas.width = AREA[0]
canvas.height = AREA[1]
canvas.style.boxSizing = 'border-box'
canvas.style.border = '2px solid Coral'
document.body.style.margin = '0'
document.body.style.backgroundColor = 'MistyRose'
document.body.appendChild(canvas)
document.body.appendChild(slider)

gl.viewport(0, 0, AREA[0], AREA[1])
gl.enable(gl.CULL_FACE)
gl.clearColor(0, 0, 0, 0)
gl.useProgram(program)

const raf = window.requestAnimationFrame
const clock = { then: Date.now(), now: Date.now() }

raf(function render() {
  clock.then = clock.now
  clock.now = Date.now()

  for ( var i = 0, G = -settings.G, dT = ( clock.now - clock.then ) / 1000; i < positions.length; i += 4 ) {
    if ( positions[ i + 1 ] < Math.random() * -100 ) {
      velocities[i + 1] = randNum(600, 900)
      positions[i] = AREA[0] / 2
      positions[i + 1] = 0
    }
    else {
      velocities[i + 1] += dT * G
      positions[i] += dT * velocities[i]
      positions[i + 1] += dT * velocities[i + 1]
    }
  }
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.uniform1f(u_locations.u_time, clock.now)
  gl.uniform1f(u_locations.u_K, settings.K)
  gl.uniform3f(u_locations.u_color, settings.color[0], settings.color[1], settings.color[2])
  gl.uniform1i(u_locations.u_positions, 0)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bufDimensions[0], bufDimensions[1], 0, gl.RGBA, gl.FLOAT, positions)
  gl.drawArrays(gl.TRIANGLES, 0, quadSize)
  raf(render)
})
