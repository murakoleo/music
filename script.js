// script.js — Final wiring for the redesigned UI
// Features:
// - Unicode symbol buttons (⏮ ⏯ ⏭ / 🔀 🔁 ♡ 🔊)
// - Playlist rendering with thumbnail, fav and drag handle (≡)
// - Drag-to-reorder (Sortable.js)
// - Shuffle / Repeat / Fav / Volume controls
// - Background gradient derived from cover image, with fallback to track.color1/color2

(function(){
  // Elements
  const music = document.getElementById('music');
  window.music = music; // keep global for compatibility

  const playBtn = document.getElementById('playBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const seekbar = document.getElementById('seekbar');
  const currentTimeEl = document.getElementById('currentTime');
  const durationEl = document.getElementById('duration');

  const titleEl = document.getElementById('title');
  const singerEl = document.getElementById('singer');
  const coverImg = document.getElementById('coverImg');
  const playlistEl = document.getElementById('playlist');

  const shuffleBtn = document.getElementById('shuffleBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  const favBtn = document.getElementById('favBtn');
  const volToggle = document.getElementById('volToggle');
  const volumeBox = document.getElementById('volumeBox');
  const volumeRange = document.getElementById('volumeRange');

  const bgOverlay = document.getElementById('bgOverlay');

  // Playlist: update these entries to match your files
  const tracks = [
    { title: "Walking with you", singer: "Novelbright", src: "songs/Walking_with_you.mp3", cover: "images/walkingwithyou.jpg", color1: "#FFB4C6", color2: "#7C5CFF", fav:false },
    { title: "It's Me", singer: "ILLIT", src: "songs/It's_Me.mp3", cover: "images/it'sme.jpg", color1: "#8FE3D7", color2: "#2D9CDB", fav:false },
    { title: "ツキミソウ", singer: "Novelbright", src: "songs/tukimisou.mp3", cover: "images/tukimisou.jpg", color1: "#CFE8FF", color2: "#6AA0FF", fav:false },
    { title: "Almond Chocolate", singer: "ILLIT", src: "songs/almond_chocolate.mp3", cover: "images/almond_chocolate.jpg", color1: "#F7D6C1", color2: "#A86A4F", fav:false },
    { title: "DREAMERS", singer: "Jungkook", src: "songs/dreamers.mp3", cover: "images/dreamers.jpg", color1: "#F7D6C1", color2: "#A86A4F", fav:false },
    { title: "Daidai", singer: "Shakira, Burna Boy", src: "songs/Shakira, Burna Boy - Dai Dai (Official Video).mp3", cover: "images/daidai.jpg", color1: "#F7D6C1", color2: "#A86A4F", fav:false },
    { title: "Shape of you", singer: "Ed Sheeran", src: "songs/Ed Sheeran - Shape of You (Official Music Video).mp3", cover: "images/shapeofyou.jpg", color1: "#F7D6C1", color2: "#A86A4F", fav:false },
    { title: "STAY", singer: "The Kid LAROI, Justin Bieber", src: "songs/The Kid LAROI Justin Bieber - STAY Official Video.mp3", cover: "images/stay.jpg", color1: "#F7D6C1", color2: "#A86A4F", fav:false }
  ];

  let currentIndex = 0;
  let isPlaying = false;
  let isRepeat = false;
  let isShuffle = false;
  let shuffleList = [];
  let shufflePos = 0;

  function pad(n){ return n < 10 ? '0' + n : '' + n; }

  // Color extraction
  function extractAverageColors(imgSrc, callback){
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imgSrc;
      img.onload = () => {
        const w = 24, h = 24;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0,0,w,h).data;
        let r=0,g=0,b=0,count=0;
        for (let i=0;i<data.length;i+=4){
          const a = data[i+3];
          if (a < 120) continue;
          r += data[i]; g += data[i+1]; b += data[i+2]; count++;
        }
        if (count === 0) return callback(null);
        r = Math.round(r/count); g = Math.round(g/count); b = Math.round(b/count);
        const dark = (c)=> Math.max(0, Math.round(c*0.45));
        callback({ color1: `rgb(${r},${g},${b})`, color2: `rgb(${dark(r)},${dark(g)},${dark(b)})` });
      };
      img.onerror = () => callback(null);
    } catch (e){ callback(null); }
  }

  function applyOverlayGradient(css){
    if (!bgOverlay) return;
    bgOverlay.style.background = css;
    bgOverlay.classList.add('visible');
  }

  function setBackgroundFromTrack(track){
    // use fallback colors immediately (fast)
    if (track && track.color1 && track.color2){
      const g0 = `radial-gradient(circle at 30% 20%, ${track.color1} 0%, rgba(0,0,0,0) 40%), linear-gradient(135deg, ${track.color1}, ${track.color2})`;
      applyOverlayGradient(g0);
    }
    // then try to extract from image and overwrite if successful
    if (track && track.cover){
      extractAverageColors(track.cover, (cols) => {
        if (!cols) return; // keep fallback
        const g = `radial-gradient(circle at 30% 20%, ${cols.color1} 0%, rgba(0,0,0,0) 40%), linear-gradient(135deg, ${cols.color1}, ${cols.color2})`;
        applyOverlayGradient(g);
      });
    }
  }

  // Playlist render
  function renderPlaylist(){
    playlistEl.innerHTML = '';
    tracks.forEach((t,i)=>{
      const li = document.createElement('li');
      li.dataset.index = i;
      if (i === currentIndex) li.classList.add('active');

      const left = document.createElement('div'); left.className = 'left';
      const thumb = document.createElement('div'); thumb.className = 'thumb';
      const img = document.createElement('img'); img.src = t.cover || 'images/default-cover.jpg'; img.alt = t.title;
      thumb.appendChild(img);

      const meta = document.createElement('div'); meta.className = 'track-meta';
      const tt = document.createElement('div'); tt.className = 'track-title'; tt.textContent = t.title;
      const ss = document.createElement('div'); ss.className = 'track-singer'; ss.textContent = t.singer;
      meta.appendChild(tt); meta.appendChild(ss);

      left.appendChild(thumb); left.appendChild(meta);

      const actions = document.createElement('div'); actions.className = 'track-actions';
      const playSmall = document.createElement('button'); playSmall.className = 'track-play'; playSmall.innerText = '▶'; playSmall.title = '再生';
      playSmall.addEventListener('click', (e)=>{ e.stopPropagation(); loadTrack(i); playTrack(); });

      const favSmall = document.createElement('button'); favSmall.className = 'fav-btn-small'; favSmall.innerText = t.fav ? '❤' : '♡'; favSmall.title = 'お気に入り';
      if (t.fav) favSmall.classList.add('fav-on');
      favSmall.addEventListener('click', (e)=>{ e.stopPropagation(); t.fav = !t.fav; renderPlaylist(); });

      const dragHandle = document.createElement('button'); dragHandle.className = 'drag-handle'; dragHandle.innerText = '≡'; dragHandle.title = 'ドラッグして並べ替え';
      dragHandle.setAttribute('aria-label','並べ替えハンドル');

      li.addEventListener('click', ()=>{ loadTrack(i); playTrack(); });
      actions.appendChild(playSmall); actions.appendChild(favSmall); actions.appendChild(dragHandle);
      li.appendChild(left); li.appendChild(actions);
      playlistEl.appendChild(li);
    });
  }

  function updateUI(){
    const t = tracks[currentIndex];
    if (!t) return;
    titleEl.textContent = t.title;
    singerEl.textContent = t.singer;
    coverImg.src = t.cover || 'images/default-cover.jpg';
    setBackgroundFromTrack(t);
    [...playlistEl.children].forEach(li => li.classList.toggle('active', Number(li.dataset.index) === currentIndex));
    playBtn.innerText = isPlaying ? '⏸' : '⏯';
    repeatBtn.classList.toggle('active', isRepeat);
    shuffleBtn.classList.toggle('active', isShuffle);
    favBtn.innerText = tracks[currentIndex].fav ? '❤' : '♡';
  }

  function loadTrack(index){
    if (index < 0 || index >= tracks.length) return;
    currentIndex = index;
    music.src = tracks[currentIndex].src;
    music.load();
    updateUI();
  }

  function playTrack(){ music.play().then(()=>{ isPlaying = true; updateUI(); }).catch(()=>{}); }
  function pauseTrack(){ music.pause(); isPlaying = false; updateUI(); }
  function togglePlayPause(){ if (music.paused) playTrack(); else pauseTrack(); }

  function buildShuffle(){
    shuffleList = tracks.map((_,i)=>i);
    for (let i = shuffleList.length-1; i>0; i--){ const j = Math.floor(Math.random()*(i+1)); [shuffleList[i], shuffleList[j]] = [shuffleList[j], shuffleList[i]]; }
    const pos = shuffleList.indexOf(currentIndex); if (pos>0) [shuffleList[0], shuffleList[pos]] = [shuffleList[pos], shuffleList[0]];
    shufflePos = 0;
  }

  function nextTrack(){
    if (tracks.length === 0) return;
    if (isShuffle){ shufflePos = Math.min(shufflePos+1, shuffleList.length-1); const next = shuffleList[shufflePos]; loadTrack(next); playTrack(); }
    else { const next = (currentIndex + 1) % tracks.length; loadTrack(next); playTrack(); }
  }
  function prevTrack(){
    if (tracks.length === 0) return;
    if (isShuffle){ shufflePos = Math.max(0, shufflePos-1); const prev = shuffleList[shufflePos]; loadTrack(prev); playTrack(); }
    else { const prev = (currentIndex - 1 + tracks.length) % tracks.length; loadTrack(prev); playTrack(); }
  }

  // wiring
  playBtn.addEventListener('click', togglePlayPause);
  nextBtn.addEventListener('click', nextTrack);
  prevBtn.addEventListener('click', prevTrack);

  music.addEventListener('loadedmetadata', ()=>{
    seekbar.max = Math.floor(music.duration || 0);
    const ds = Math.floor(music.duration % 60); const dm = Math.floor((music.duration / 60) % 60);
    durationEl.textContent = dm + ':' + pad(ds);
  });
  music.addEventListener('timeupdate', ()=>{
    seekbar.value = Math.floor(music.currentTime || 0);
    const cs = Math.floor(music.currentTime % 60); const cm = Math.floor((music.currentTime / 60) % 60);
    currentTimeEl.textContent = cm + ':' + pad(cs);
  });
  seekbar.addEventListener('input', ()=>{ music.currentTime = seekbar.value; });

  music.addEventListener('ended', ()=>{ if (isRepeat){ music.currentTime = 0; playTrack(); } else nextTrack(); });

  shuffleBtn.addEventListener('click', ()=>{ isShuffle = !isShuffle; if (isShuffle) buildShuffle(); shuffleBtn.classList.toggle('active', isShuffle); });
  repeatBtn.addEventListener('click', ()=>{ isRepeat = !isRepeat; repeatBtn.classList.toggle('active', isRepeat); });
  favBtn.addEventListener('click', ()=>{ const t = tracks[currentIndex]; if (t){ t.fav = !t.fav; renderPlaylist(); updateUI(); } });

  volToggle.addEventListener('click', ()=>{ volumeBox.style.display = volumeBox.style.display === 'block' ? 'none' : 'block'; });
  document.querySelectorAll('.volume-down').forEach(el => el.addEventListener('click', ()=>{ volumeRange.value = Math.max(0, Number(volumeRange.value)-10); music.volume = volumeRange.value/100; }));
  document.querySelectorAll('.volume-up').forEach(el => el.addEventListener('click', ()=>{ volumeRange.value = Math.min(100, Number(volumeRange.value)+10); music.volume = volumeRange.value/100; }));
  volumeRange.addEventListener('input', ()=>{ music.volume = volumeRange.value / 100; });

  document.addEventListener('keydown', (e)=>{ if (e.code === 'Space'){ e.preventDefault(); togglePlayPause(); } else if (e.code === 'ArrowRight') nextTrack(); else if (e.code === 'ArrowLeft') prevTrack(); });

  // Sortable init
  function initSortable(){
    if (typeof Sortable === 'undefined') return;
    const sortable = Sortable.create(playlistEl, { handle: '.drag-handle', animation: 160, onEnd: (evt)=>{
      const oldIndex = evt.oldIndex, newIndex = evt.newIndex; if (oldIndex === newIndex) return;
      const moved = tracks.splice(oldIndex,1)[0]; tracks.splice(newIndex,0,moved);
      if (currentIndex === oldIndex) currentIndex = newIndex;
      else if (oldIndex < currentIndex && newIndex >= currentIndex) currentIndex--;
      else if (oldIndex > currentIndex && newIndex <= currentIndex) currentIndex++;
      renderPlaylist(); updateUI();
    }});
  }

  // init
  renderPlaylist(); initSortable(); loadTrack(0); music.volume = (volumeRange && volumeRange.value) ? volumeRange.value / 100 : 0.8;

})();
