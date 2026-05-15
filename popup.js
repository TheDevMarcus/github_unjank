(function () {
  var img = document.getElementById('logo-img');
  var svg = document.getElementById('logo-svg');
  if (img && svg) {
    img.addEventListener('error', function () {
      img.style.display = 'none';
      svg.style.display = 'block';
    });
  }
})();