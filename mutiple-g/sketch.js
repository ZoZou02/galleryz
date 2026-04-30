// Draw custom shape at current position
function drawShape(p) {
  p.beginShape();
  p.vertex(21, 5);
  p.vertex(30, 14);
  p.vertex(43, 0);
  p.vertex(0, -43);
  p.vertex(-43, 0);
  p.vertex(0, 43);
  p.vertex(25, 18);
  p.vertex(-6, -14);
  p.vertex(-14, -6);
  p.vertex(8, 19);
  p.vertex(0, 25);
  p.vertex(-25, 0);
  p.vertex(0, -25);
  p.vertex(25, 0);
  p.endShape(p.CLOSE);
}

// Factory function to create sketch instances
function createSketch(config) {
  return function(p) {
    let isLeftPressed = false;
    
    p.setup = function () {
      let isLandscape = p.windowWidth > p.windowHeight;
      let canvasWidth = isLandscape ? p.windowWidth / 2 : p.windowWidth;
      let canvasHeight = p.windowWidth / 5;
      p.createCanvas(canvasWidth, canvasHeight);
      p.background(config.bgColor);
      p.strokeWeight(1);
      p.noCursor();
    };

    p.windowResized = function () {
      let isLandscape = p.windowWidth > p.windowHeight;
      let canvasWidth = isLandscape ? p.windowWidth / 2 : p.windowWidth;
      let canvasHeight = p.windowWidth / 5;
      p.resizeCanvas(canvasWidth, canvasHeight);
      p.background(config.bgColor);
    };

    p.mousePressed = function () {
      if (p.mouseButton === 'left' || p.mouseButton.left) {
        isLeftPressed = true;
      }
    };

    p.mouseReleased = function () {
      isLeftPressed = false;
    };

    p.draw = function () {
      if (isLeftPressed) {
        p.fill(config.pressedFill);
        p.stroke(config.pressedStroke);
      } else {
        p.fill(config.defaultFill);
        p.stroke(config.defaultStroke);
      }
      p.push();
      p.translate(p.mouseX, p.mouseY);
      p.scale(0.5);
      drawShape(p);
      p.pop();
    };
  };
}

// sketch1: 粉色背景，默认白色填充，按住变粉色填充
new p5(createSketch({
  bgColor: '#fd2d5c',
  defaultFill: 255,
  defaultStroke: '#fd2d5c',
  pressedFill: '#fd2d5c',
  pressedStroke: 255
}));

// sketch2: 白色背景，默认粉色填充，按住变白色填充
new p5(createSketch({
  bgColor: 255,
  defaultFill: '#fd2d5c',
  defaultStroke: 255,
  pressedFill: 255,
  pressedStroke: '#fd2d5c'
}));