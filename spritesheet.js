function getVerticalOffset() {
	let yOffset = document.getElementById('vOffset').value;
	return parseInt(yOffset);
}

function isAutofit() {
	return document.getElementById('autofit').checked;
}

function getAnchorOffset(cellBound, sizeBound, anchor) {
	if (anchor === 0) {
		return 0;
	} else if (anchor === 1) {
		return (cellBound - sizeBound) / 2;
	} else if (anchor === 2) {
		return cellBound - sizeBound;
	}
}

function getCheckedAnchor() {
	const checked = document.querySelector('#anchorGrid input[name="anchor"]:checked');
	if (!checked) return [1, 1];
	return checked.dataset.anchor.split(',').map(Number);
}

function combineBtn() {

	let selectedAnchor = getCheckedAnchor();

	let fileInput = document.getElementById('imageInput');
	let files = fileInput.files;
	let images = [];
	let maxWidth = 0;
	let maxHeight = 0;

	let loadImagePromises = [];
	for (let i = 0; i < files.length; i++) {
		let img = new Image();
		let file = files[i];
		let reader = new FileReader();
		let promise = new Promise((resolve, reject) => {
			reader.onload = (e) => {
				img.onload = () => {
					if (isAutofit()) {
						let canvas = document.createElement('canvas');
						canvas.width = img.width;
						canvas.height = img.height;
						let ctx = canvas.getContext('2d');
						ctx.drawImage(img, 0, 0);
						let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
						let data = imageData.data;

						let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
						let found = false;

						for (let y = 0; y < canvas.height; y++) {
							for (let x = 0; x < canvas.width; x++) {
								let idx = (y * canvas.width + x) * 4;
								let r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
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
							croppedImg.onload = () => {
								maxWidth = Math.max(maxWidth, croppedImg.width);
								maxHeight = Math.max(maxHeight, croppedImg.height);
								images.push(croppedImg);
								resolve();
							};
							croppedImg.src = croppedCanvas.toDataURL();
						} else {
							maxWidth = Math.max(maxWidth, img.width);
							maxHeight = Math.max(maxHeight, img.height);
							images.push(img);
							resolve();
						}
					} else {
						maxWidth = Math.max(maxWidth, img.width);
						maxHeight = Math.max(maxHeight, img.height);
						images.push(img);
						resolve();
					}
				};
				img.src = e.target.result;
			};
			reader.readAsDataURL(file);
		});
		loadImagePromises.push(promise);
	}


	Promise.all(loadImagePromises).then(() => {
		let totalWidth = maxWidth * images.length;
		let totalHeight = maxHeight + Math.abs(getVerticalOffset() * 2);

		let canvas = document.createElement('canvas');
		canvas.width = totalWidth;
		canvas.height = totalHeight;

		let ctx = canvas.getContext('2d');

		ctx.imageSmoothingEnabled = false;

		const anchorX = selectedAnchor[0];
		const anchorY = selectedAnchor[1];

		images.forEach((img, index) => {
			let x = index * maxWidth;
			let y = 0;

			let offsetX = getAnchorOffset(maxWidth, img.width, anchorY);
			let offsetY = getAnchorOffset(totalHeight, img.height, anchorX);

			ctx.drawImage(img, x + offsetX, y + offsetY - getVerticalOffset());
		});

		document.getElementById("output").textContent = "#vars: " + images.length + ", #pxlSz:point(" + maxWidth + ", " + totalHeight + ")";

		let link = document.createElement('a');
		link.href = canvas.toDataURL('image/png');
		link.download = 'spritesheet.png';
		link.click();
	});
};