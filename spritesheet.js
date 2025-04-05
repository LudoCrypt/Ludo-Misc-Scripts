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
					maxWidth = Math.max(maxWidth, img.width);
					maxHeight = Math.max(maxHeight, img.height);
					images.push(img);
					resolve();
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