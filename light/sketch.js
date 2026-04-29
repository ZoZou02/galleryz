function setup() {
  createCanvas(600, 600, WEBGL);
  // debugMode()
}

function draw() {
  background(200);
  camera(-100, -500, -100, 0, 0, 0, 0, 1, 0);
//   orbitControl();
  noStroke();
  ambientLight(150);
  directionalLight(255, 255, 255, 45, 45, 45);
  
  let row = 10;
  let col = 10;
  let gap = 100;
  let r = 5; //圆柱半径
  let h = 60; //圆柱高度

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
      
      push();
      
      // 影子中心在地板上，和圆柱底部中心对齐偏移
      translate(px+h/2, h/2 - 0.1, pz+3*r);
      // 关键：不做任何旋转，直接平贴在地板上
      rotateX(HALF_PI); // 让平面躺平
      rotateZ(90)
      
      // 调整影子大小：宽度=圆柱直径，长度=顺着光源拉长
      fill(0, 70); // 半透明黑色
      scale(r*2, h*1.2, 1); // 宽=直径，长=圆柱高度*系数，控制影子长度
      plane(1, 1); // 用1x1平面，靠scale调整
      pop();

      push();
      translate(px, 0, pz);

      fill(251, 251, 251);
      cylinder(r, h);
      pop();
    }
  }
}
