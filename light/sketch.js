function setup() {
  createCanvas(600, 600, WEBGL);
  // debugMode()
}

function draw() {
  background(200);
  camera(-100, -500, -100, 0, 0, 0, 0, 1, 0);
  orbitControl();
  noStroke();
  ambientLight(150);
  
  let row = 10;
  let col = 10;
  let gap = 100;
  let r = 5;
  let h = 60;
  
  let lightAngle = radians(frameCount * 0.5);
  let lightX = cos(lightAngle);
  let lightZ = sin(lightAngle);
  let lightY = 1;
  let lightDir = createVector(lightX, lightY, lightZ).normalize();
  let shadowLength = h * 0.75;
  
  directionalLight(255, 255, 255, lightX, lightY, lightZ);

  // ========== 先画底部平面(地板) ==========
  push();
  translate(200, h / 2, 200); // 刚好贴在圆柱底部
  rotateX(HALF_PI);
  fill(237, 34, 93);
  plane(1200, 1200);
  pop();

  for (let x = 0; x < col; x++) {
    for (let z = 0; z < row; z++) {
      let px = (x - 2) * gap;
      let pz = (z - 2) * gap;
      
      drawCylinderShadow(px, pz, r, h, lightDir, shadowLength);

      push();
      translate(px, 0, pz);
      fill(251, 251, 251);
      cylinder(r, h);
      pop();
    }
  }
}

function drawCylinderShadow(cx, cz, r, h, lightDir, shadowLength) {
  push();
  translate(cx, h/2 - 0.1, cz);
  rotateX(HALF_PI);
  
  let angle = atan2(lightDir.z, lightDir.x);
  rotateZ(angle - HALF_PI);
  
  fill(0, 60);
  
  let len = shadowLength;
  
  beginShape();
  vertex(-r, 0);
  vertex(r, 0);
  
  for (let a = 0; a <= PI; a += 0.1) {
    let x = r * cos(a);
    let y = len + r * sin(a);
    vertex(x, y);
  }
  
  vertex(-r, len);
  endShape(CLOSE);
  
  pop();
}
