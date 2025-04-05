function getVerticalOffset() {
	let yOffset = document.getElementById('vOffset')
		.value;
	return parseInt(yOffset);
}

function isAutofit() {
	return document.getElementById('autofit')
		.checked;
}

function getAnchorOffset(cellBound, sizeBound, anchor) {
	if (anchor === 0) {
		return 0;
	}
	else if (anchor === 1) {
		return (cellBound - sizeBound) / 2;
	}
	else if (anchor === 2) {
		return cellBound - sizeBound;
	}
}

function getCheckedAnchor() {
	const checked = document.querySelector('#anchorGrid input[name="anchor"]:checked');
	if (!checked) return [1, 1];
	return checked.dataset.anchor.split(',')
		.map(Number);
}
async function combineBtn() {
	let selectedAnchor = getCheckedAnchor();
	let fileInput = document.getElementById('imageInput');
	let files = fileInput.files;
	let images = [];
	let maxWidth = [];
	let maxHeight = [];
	let loadImagePromises = [];
	for (let i = 0; i < files.length; i++) {
		let imgLd = new Image();
		let file = files[i];
		let reader = new FileReader();
		let promise = new Promise((resolve, reject) => {
			reader.onload = (e) => {
				imgLd.onload = async () => {
					const innerPromises = [];

					function processImg(img) {
						if (isAutofit()) {
							let canvas = document.createElement('canvas');
							canvas.width = img.width;
							canvas.height = img.height;
							let ctx = canvas.getContext('2d');
							ctx.drawImage(img, 0, 0);
							let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
							let data = imageData.data;
							let minX = canvas.width,
								minY = canvas.height,
								maxX = 0,
								maxY = 0;
							let found = false;
							for (let y = 0; y < canvas.height; y++) {
								for (let x = 0; x < canvas.width; x++) {
									let idx = (y * canvas.width + x) * 4;
									let r = data[idx],
										g = data[idx + 1],
										b = data[idx + 2],
										a = data[idx + 3];
									let isWhite = r === 255 && g === 255 && b === 255;
									if (a !== 0 && !isWhite) {
										minX = Math.min(minX, x);
										minY = Math.min(minY, y);
										maxX = Math.max(maxX, x);
										maxY = Math.max(maxY, y);
										found = true;
									}
								}
							}
							if (found) {
								let w = maxX - minX + 1;
								let h = maxY - minY + 1;
								let croppedCanvas = document.createElement('canvas');
								croppedCanvas.width = w;
								croppedCanvas.height = h;
								let croppedCtx = croppedCanvas.getContext('2d');
								croppedCtx.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
								let croppedImg = new Image();
								let innerPromise = new Promise(res => {
									croppedImg.onload = () => {
										images.push(croppedImg);
										maxWidth.push(croppedImg.width);
										maxHeight.push(croppedImg.height);
										res();
									};
								});
								croppedImg.src = croppedCanvas.toDataURL();
								innerPromises.push(innerPromise);
							}
							else {
								images.push(img);
								maxWidth.push(img.width);
								maxHeight.push(img.height);
							}
						}
						else {
							images.push(img);
							maxWidth.push(img.width);
							maxHeight.push(img.height);
						}
					}

					function extractShapesFromImage(img) {
						const shapePromises = [];
						let canvas = document.createElement('canvas');
						canvas.width = img.width;
						canvas.height = img.height;
						let ctx = canvas.getContext('2d');
						ctx.drawImage(img, 0, 0);
						let imageData = ctx.getImageData(0, 0, img.width, img.height);
						let data = imageData.data;
						let width = img.width;
						let height = img.height;
						let visited = new Set();
						let shapes = [];

						function cantIgnore(x, y) {
							return data[(y * width + x) * 4 + 3] !== 0 && !(data[(y * width + x) * 4] === 255 && data[(y * width + x) * 4 + 1] === 255 && data[(y * width + x) * 4 + 2] === 255);
						}

						function findShapeBounds(startX, startY) {
							let stack = [
								[startX, startY]
							];
							let key = `${startX},${startY}`;
							visited.add(key);
							let minX = startX,
								maxX = startX;
							let minY = startY,
								maxY = startY;
							let shapePixels = [];
							while (stack.length > 0) {
								let [x, y] = stack.pop();
								shapePixels.push([x, y]);
								minX = Math.min(minX, x);
								maxX = Math.max(maxX, x);
								minY = Math.min(minY, y);
								maxY = Math.max(maxY, y);
								for (let [dx, dy] of [
										[-1, 0],
										[1, 0],
										[0, -1],
										[0, 1],
										[-1, -1],
										[1, 1],
										[-1, 1],
										[1, -1]
									]) {
									let nx = x + dx;
									let ny = y + dy;
									let nkey = `${nx},${ny}`;
									if (nx >= 0 && ny >= 0 && nx < width && ny < height && !visited.has(nkey) && cantIgnore(nx, ny)) {
										visited.add(nkey);
										stack.push([nx, ny]);
									}
								}
							}
							return {
								minX,
								maxX,
								minY,
								maxY,
								shapePixels
							};
						}
						for (let y = 0; y < height; y++) {
							for (let x = 0; x < width; x++) {
								let key = `${x},${y}`;
								if (!visited.has(key) && cantIgnore(x, y)) {
									let {
										minX,
										maxX,
										minY,
										maxY,
										shapePixels
									} = findShapeBounds(x, y);
									let shapeCanvas = document.createElement('canvas');
									let sw = maxX - minX + 1;
									let sh = maxY - minY + 1;
									shapeCanvas.width = sw;
									shapeCanvas.height = sh;
									let sctx = shapeCanvas.getContext('2d');
									let shapeImageData = sctx.createImageData(sw, sh);
									for (let [px, py] of shapePixels) {
										let srcIdx = (py * width + px) * 4;
										let dx = px - minX;
										let dy = py - minY;
										let dstIdx = (dy * sw + dx) * 4;
										for (let i = 0; i < 4; i++) {
											shapeImageData.data[dstIdx + i] = data[srcIdx + i];
										}
									}
									sctx.putImageData(shapeImageData, 0, 0);
									let shapedImg = new Image();
									let shapePromise = new Promise(res => {
										shapedImg.onload = () => {
											processImg(shapedImg);
											res();
										};
									});
									shapedImg.src = shapeCanvas.toDataURL();
									shapePromises.push(shapePromise);
								}
							}
						}
						return Promise.all(shapePromises);
					}
					const inputType = document.getElementById("uploadTypeBox")
						.value;
					switch (inputType) {
						case "spritesheet":
							await extractShapesFromImage(imgLd);
							break;
						case "multiple":
						default:
							processImg(imgLd);
							break;
					}
					await Promise.all(innerPromises);
					resolve();
				};
				imgLd.src = e.target.result;
			};
			reader.readAsDataURL(file);
		});
		loadImagePromises.push(promise);
	}
	Promise.all(loadImagePromises)
		.then(() => {
			let finalWidth = 0;
			let finalHeight = 0;
			maxWidth.forEach((w) => {
				finalWidth = Math.max(w, finalWidth);
			});
			maxHeight.forEach((h) => {
				finalHeight = Math.max(h, finalHeight);
			});
			let totalWidth = finalWidth * images.length;
			let totalHeight = finalHeight + Math.abs(getVerticalOffset() * 2);
			let canvas = document.createElement('canvas');
			canvas.width = totalWidth;
			canvas.height = totalHeight;
			let ctx = canvas.getContext('2d');
			ctx.imageSmoothingEnabled = false;
			const anchorX = selectedAnchor[0];
			const anchorY = selectedAnchor[1];
			const sortType = document.getElementById("sortTypeBox")
				.value;
			switch (sortType) {
				case "widtha":
					images.sort((a, b) => a.width - b.width);
					break;
				case "heighta":
					images.sort((a, b) => a.height - b.height);
					break;
				case "areaa":
					images.sort((a, b) => a.width / a.height - b.width / b.height);
					break;
				case "widthb":
					images.sort((a, b) => b.width - a.width);
					break;
				case "heightb":
					images.sort((a, b) => b.height - a.height);
					break;
				case "areab":
					images.sort((a, b) => b.width / b.height - a.width / a.height);
					break;
				default:
					break;
			}
			images.forEach((img, index) => {
				let x = index * finalWidth;
				let y = 0;
				let offsetX = getAnchorOffset(finalWidth, img.width, anchorY);
				let offsetY = getAnchorOffset(totalHeight, img.height, anchorX);
				ctx.drawImage(img, x + offsetX, y + offsetY - getVerticalOffset());
			});
			document.getElementById("output")
				.textContent = "#vars: " + images.length + ", #pxlSz:point(" + finalWidth + ", " + totalHeight + ")";
			let link = document.createElement('a');
			link.href = canvas.toDataURL('image/png');
			link.download = 'spritesheet.png';
			link.click();
		});
};