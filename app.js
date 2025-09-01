document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('soccer-field');
    const ctx = canvas.getContext('2d');

    // --- State ---
    let players = [];
    let formations = {};
    let selectedPlayer = null;
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
    let isDrawMode = false;
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let drawingPaths = [];

    // --- Field Buffer (for performance) ---
    const fieldBuffer = document.createElement('canvas');
    const fieldCtx = fieldBuffer.getContext('2d');

    // --- Drill Tools State ---
    let currentTool = 'freehand'; // 'freehand' | 'arrow' | 'cone'
    let arrows = []; // {x1,y1,x2,y2}
    let cones = [];  // {x,y}
    let tempArrow = null; // {x1,y1,x2,y2} while drawing

    // --- Assets ---
    const ICON_SIZE = 64;
    const playerIcons = {
        home: new Image(),
        opponent: new Image()
    };
    let iconsLoaded = { home: false, opponent: false };
    playerIcons.home.onload = () => { iconsLoaded.home = true; draw(); };
    playerIcons.opponent.onload = () => { iconsLoaded.opponent = true; draw(); };
    playerIcons.home.src = 'assets/player-home.svg';
    playerIcons.opponent.src = 'assets/player-opponent.svg';

    // Ball icon
    const BALL_SIZE = 40;
    const ballImage = new Image();
    let ballIconLoaded = false;
    let ball = { x: 0, y: 0 };
    let isDraggingBall = false;
    ballImage.onload = () => { ballIconLoaded = true; draw(); };
    // Prefer PNG if provided; fall back to SVG when missing
    ballImage.onerror = () => { ballImage.src = 'assets/soccer-ball.svg'; };
    ballImage.src = 'assets/soccer-ball.png';

    // --- DOM Elements ---
    const playerNameInput = document.getElementById('player-name');
    const addPlayerBtn = document.getElementById('add-player');
    const isOpponentCheckbox = document.getElementById('is-opponent');
    const benchElement = document.getElementById('bench-players');
    const benchContainer = document.getElementById('bench');
    const controlsContainer = document.getElementById('controls');
    const controlsToggle = document.getElementById('controls-toggle');
    const benchToggle = document.getElementById('bench-toggle');
    // Ensure readable toggle labels
    if (controlsToggle) {
        controlsToggle.textContent = 'Controls';
        controlsToggle.setAttribute('aria-label', 'Toggle controls');
        controlsToggle.classList.add('controls');
    }
    if (benchToggle) {
        benchToggle.textContent = 'Bench';
        benchToggle.setAttribute('aria-label', 'Toggle bench');
        benchToggle.classList.add('bench');
    }
    const themeSwitch = document.getElementById('checkbox');

    const formationNameInput = document.getElementById('formation-name');
    const saveFormationBtn = document.getElementById('save-formation');
    const formationSelect = document.getElementById('formation-select');
    const renameFormationBtn = document.getElementById('rename-formation');
    const deleteFormationBtn = document.getElementById('delete-formation');

    const timerDurationInput = document.getElementById('timer-duration');
    const startTimerBtn = document.getElementById('start-timer');
    const stopTimerBtn = document.getElementById('stop-timer');
    const resetTimerBtn = document.getElementById('reset-timer');
    const timerDisplay = document.getElementById('timer-display');

    const toggleDrawModeBtn = document.getElementById('toggle-draw-mode');
    const clearDrawingBtn = document.getElementById('clear-drawing');
    const toolFreehandBtn = document.getElementById('tool-freehand');
    const toolArrowBtn = document.getElementById('tool-arrow');
    const toolConeBtn = document.getElementById('tool-cone');

    const notesTextarea = document.getElementById('notes');

    // --- Canvas Sizing ---
    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        let w = canvas.clientWidth || canvas.offsetWidth;
        let h = canvas.clientHeight || canvas.offsetHeight;
        if (!w || !h) {
            const parent = canvas.parentElement;
            if (parent) {
                const rect = parent.getBoundingClientRect();
                w = rect.width || window.innerWidth;
                h = rect.height || Math.max(200, window.innerHeight * 0.6);
            } else {
                w = window.innerWidth;
                h = Math.max(200, window.innerHeight * 0.6);
            }
        }
        // Ensure CSS size
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        // Backing store size in device pixels
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        // Scale drawing to CSS pixel coordinates
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Offscreen buffer uses same scaling
        fieldBuffer.width = Math.round(w * dpr);
        fieldBuffer.height = Math.round(h * dpr);
        fieldCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawField(fieldCtx, w, h);
        draw();
    }

    window.addEventListener('resize', resizeCanvas);
    // Handle dynamic viewport changes on mobile (address bar show/hide)
    try {
        const ro = new ResizeObserver(() => resizeCanvas());
        if (canvas && canvas.parentElement) ro.observe(canvas.parentElement);
    } catch (_) {}
    window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 300));
    window.addEventListener('load', resizeCanvas);
    window.addEventListener('load', resizeCanvas);


    // --- Drawing ---
    function drawField(targetCtx, width, height) {
        targetCtx.clearRect(0, 0, width, height);
        targetCtx.strokeStyle = 'white';
        targetCtx.lineWidth = 2;

        const fieldWidthYards = 60;
        const fieldHeightYards = 40;
        const yardsToPixelsX = width / fieldWidthYards;
        const yardsToPixelsY = height / fieldHeightYards;
        const avgYardsToPixels = (yardsToPixelsX + yardsToPixelsY) / 2;

        // Outer lines
        targetCtx.strokeRect(0, 0, width, height);

        // Halfway line
        targetCtx.beginPath();
        targetCtx.moveTo(width / 2, 0);
        targetCtx.lineTo(width / 2, height);
        targetCtx.stroke();

        // Center circle
        const centerCircleRadius = 4 * avgYardsToPixels;
        targetCtx.beginPath();
        targetCtx.arc(width / 2, height / 2, centerCircleRadius, 0, 2 * Math.PI);
        targetCtx.stroke();

        // Penalty Box
        const penaltyBoxWidth = 10 * yardsToPixelsX;
        const penaltyBoxHeight = 18 * yardsToPixelsY;
        targetCtx.strokeRect(0, height / 2 - penaltyBoxHeight / 2, penaltyBoxWidth, penaltyBoxHeight);
        targetCtx.strokeRect(width - penaltyBoxWidth, height / 2 - penaltyBoxHeight / 2, penaltyBoxWidth, penaltyBoxHeight);
        
        // Goal Area
        const goalAreaWidth = 4 * yardsToPixelsX;
        const goalAreaHeight = 8 * yardsToPixelsY;
        targetCtx.strokeRect(0, height / 2 - goalAreaHeight / 2, goalAreaWidth, goalAreaHeight);
        targetCtx.strokeRect(width - goalAreaWidth, height / 2 - goalAreaHeight / 2, goalAreaWidth, goalAreaHeight);

        // Penalty Dot
        const penaltyDotX1 = 8 * yardsToPixelsX;
        const penaltyDotX2 = width - penaltyDotX1;
        targetCtx.beginPath();
        targetCtx.arc(penaltyDotX1, height / 2, 2, 0, 2 * Math.PI);
        targetCtx.fill();
        targetCtx.beginPath();
        targetCtx.arc(penaltyDotX2, height / 2, 2, 0, 2 * Math.PI);
        targetCtx.fill();

        // Penalty Arc
        const penaltyArcRadius = 4 * avgYardsToPixels;
        const angle = Math.acos((penaltyBoxWidth - penaltyDotX1) / penaltyArcRadius);
        targetCtx.beginPath();
        targetCtx.arc(penaltyDotX1, height / 2, penaltyArcRadius, -angle, angle);
        targetCtx.stroke();
        targetCtx.beginPath();
        targetCtx.arc(penaltyDotX2, height / 2, penaltyArcRadius, Math.PI - angle, Math.PI + angle);
        targetCtx.stroke();

        // Build out lines
        const buildOutLineX1 = 20 * yardsToPixelsX;
        const buildOutLineX2 = width - buildOutLineX1;
        targetCtx.beginPath();
        targetCtx.setLineDash([5, 5]);
        targetCtx.moveTo(buildOutLineX1, 0);
        targetCtx.lineTo(buildOutLineX1, height);
        targetCtx.moveTo(buildOutLineX2, 0);
        targetCtx.lineTo(buildOutLineX2, height);
        targetCtx.stroke();
        targetCtx.setLineDash([]);
        
        // Corner Arcs
        const cornerArcRadius = 1 * yardsToPixelsX;
        targetCtx.beginPath();
        targetCtx.arc(0, 0, cornerArcRadius, 0, Math.PI / 2);
        targetCtx.stroke();
        targetCtx.beginPath();
        targetCtx.arc(width, 0, cornerArcRadius, Math.PI / 2, Math.PI);
        targetCtx.stroke();
        targetCtx.beginPath();
        targetCtx.arc(0, height, cornerArcRadius, -Math.PI / 2, 0);
        targetCtx.stroke();
        targetCtx.beginPath();
        targetCtx.arc(width, height, cornerArcRadius, Math.PI, -Math.PI / 2);
        targetCtx.stroke();
    }

    function drawDrawingPaths() {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        drawingPaths.forEach(path => {
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
                ctx.lineTo(path[i].x, path[i].y);
            }
            ctx.stroke();
        });
    }
    function drawArrows() {
        const drawOne = (a) => {
            const { x1, y1, x2, y2 } = a;
            ctx.strokeStyle = '#ff3b30';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const headLen = 12;
            const a1x = x2 - headLen * Math.cos(angle - Math.PI / 6);
            const a1y = y2 - headLen * Math.sin(angle - Math.PI / 6);
            const a2x = x2 - headLen * Math.cos(angle + Math.PI / 6);
            const a2y = y2 - headLen * Math.sin(angle + Math.PI / 6);
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(a1x, a1y);
            ctx.moveTo(x2, y2);
            ctx.lineTo(a2x, a2y);
            ctx.stroke();
        };
        arrows.forEach(drawOne);
        if (tempArrow) drawOne(tempArrow);
    }

    const CONE_SIZE = 24;
    const coneImage = new Image();
    let coneIconLoaded = false;
    coneImage.onload = () => { coneIconLoaded = true; draw(); };
    coneImage.src = 'assets/cone.svg';
    function drawCones() {
        const size = CONE_SIZE;
        cones.forEach(c => {
            if (coneIconLoaded) {
                ctx.drawImage(coneImage, c.x - size / 2, c.y - size / 2, size, size);
            } else {
                ctx.fillStyle = '#ff8c00';
                ctx.beginPath();
                ctx.moveTo(c.x, c.y - size / 2);
                ctx.lineTo(c.x - size / 2, c.y + size / 2);
                ctx.lineTo(c.x + size / 2, c.y + size / 2);
                ctx.closePath();
                ctx.fill();
            }
        });
    }

    function drawPlayers() {
        players.forEach(player => {
            if (!player.isBenched) {
                const team = player.team === 'opponent' ? 'opponent' : 'home';
                const icon = playerIcons[team];
                const size = ICON_SIZE;
                if ((team === 'opponent' && iconsLoaded.opponent) || (team === 'home' && iconsLoaded.home)) {
                    ctx.drawImage(icon, player.x - size / 2, player.y - size / 2, size, size);
                } else {
                    // Fallback to colored circle while icons load
                    const fillColor = team === 'opponent' ? '#1E88E5' : '#FF5A5F';
                    ctx.beginPath();
                    ctx.fillStyle = fillColor;
                    ctx.arc(player.x, player.y, size / 2, 0, 2 * Math.PI);
                    ctx.fill();
                }
                // Name label with subtle outline for readability
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                const nameY = player.y + size / 2 + 12;
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                ctx.strokeText(player.name, player.x, nameY);
                ctx.fillStyle = 'black';
                ctx.fillText(player.name, player.x, nameY);
            }
        });
    }

    function draw() {
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Blit pre-rendered field with CSS pixel sizing
        ctx.drawImage(fieldBuffer, 0, 0, canvas.width / dpr, canvas.height / dpr);
        drawDrawingPaths();
        drawArrows();
        drawCones();
        drawBall();
        drawPlayers();
    }

    function drawBall() {
        if (!ball.x && !ball.y) return;
        const size = BALL_SIZE;
        if (ballIconLoaded) {
            ctx.drawImage(ballImage, ball.x - size / 2, ball.y - size / 2, size, size);
        } else {
            ctx.beginPath();
            ctx.fillStyle = '#ffffff';
            ctx.arc(ball.x, ball.y, size / 2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#222';
            ctx.stroke();
        }
    }

    // --- Player Management ---
    function addPlayer() {
        const name = playerNameInput.value.trim();
        if (name) {
            const newPlayer = {
                id: Date.now(),
                name: name,
                x: 0,
                y: 0,
                isBenched: true,
                team: (isOpponentCheckbox && isOpponentCheckbox.checked) ? 'opponent' : 'home'
            };
            players.push(newPlayer);
            savePlayers();
            playerNameInput.value = '';
            if (isOpponentCheckbox) { isOpponentCheckbox.checked = false; }
            renderBench();
        }
    }

    function savePlayers() {
        localStorage.setItem('soccerPlayers', JSON.stringify(players));
    }

    function loadPlayers() {
        const savedPlayers = localStorage.getItem('soccerPlayers');
        if (savedPlayers) {
            players = JSON.parse(savedPlayers);
            players.forEach(p => { if (!p.team) { p.team = 'home'; } });
        }
    }

    function renderBench() {
        benchElement.innerHTML = '';
        players.filter(p => p.isBenched).forEach(player => {
            const playerChip = document.createElement('div');
            playerChip.className = 'player-chip';
            if (player.team === 'opponent') { playerChip.classList.add('opponent'); } else { playerChip.classList.add('home'); }
            const nameSpan = document.createElement('span');
            nameSpan.className = 'player-name';
            nameSpan.textContent = player.name;
            nameSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                renamePlayer(player.id);
            });
            nameSpan.addEventListener('click', (e) => {
                // Prevent accidental drag start when intending to rename
                e.stopPropagation();
            });

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.setAttribute('aria-label', `Remove ${player.name}`);
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removePlayer(player.id);
            });

            playerChip.appendChild(nameSpan);
            playerChip.appendChild(removeBtn);
            playerChip.dataset.playerId = player.id;
            // Unified drag from bench using Pointer Events
            playerChip.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                selectedPlayer = player;
                isDragging = true;
                // When dragging from bench, let the drop set final position
                offsetX = 0;
                offsetY = 0;
            });
            benchElement.appendChild(playerChip);
        });
    }

    function removePlayer(id) {
        players = players.filter(p => p.id !== id);
        savePlayers();
        renderBench();
        draw();
    }
    function renamePlayer(id) {
        const player = players.find(p => p.id === id);
        if (!player) return;
        const newName = prompt('Enter new name', player.name);
        if (newName === null) return; // cancelled
        const trimmed = newName.trim();
        if (!trimmed) return; // ignore empty
        player.name = trimmed;
        savePlayers();
        renderBench();
        draw();
    }

    // --- Drag and Drop & Drawing ---
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
    });

    function handleMouseDown(e) {
        const pos = getMousePos(canvas, e);
        lastX = pos.x;
        lastY = pos.y;

        if (isDrawMode) {
            if (currentTool === 'freehand') {
                isDrawing = true;
                drawingPaths.push([{x: lastX, y: lastY}]);
            } else if (currentTool === 'arrow') {
                isDrawing = true;
                tempArrow = { x1: lastX, y1: lastY, x2: lastX, y2: lastY };
            } else if (currentTool === 'cone') {
                cones.push({ x: lastX, y: lastY });
                draw();
            }
        } else {
            // Check ball first
            if (typeof isMouseOverBall === 'function' && isMouseOverBall(pos.x, pos.y)) {
                selectedPlayer = null;
                isDragging = true;
                isDraggingBall = true;
                offsetX = pos.x - ball.x;
                offsetY = pos.y - ball.y;
                return;
            }
            players.slice().reverse().forEach(player => {
                if (!player.isBenched && isMouseOverPlayer(player, pos.x, pos.y)) {
                    selectedPlayer = player;
                    isDragging = true;
                    offsetX = pos.x - player.x;
                    offsetY = pos.y - player.y;
                }
            });
        }
    }

    function handleMouseMove(e) {
        const pos = getMousePos(canvas, e);
        if (isDrawing) {
            if (currentTool === 'freehand') {
                drawingPaths[drawingPaths.length - 1].push({x: pos.x, y: pos.y});
                draw();
            } else if (currentTool === 'arrow' && tempArrow) {
                tempArrow.x2 = pos.x;
                tempArrow.y2 = pos.y;
                draw();
            }
        } else if (isDragging && isDraggingBall) {
            ball.x = pos.x - offsetX;
            ball.y = pos.y - offsetY;
            draw();
        } else if (isDragging && selectedPlayer) {
            selectedPlayer.x = pos.x - offsetX;
            selectedPlayer.y = pos.y - offsetY;
            draw();
        }
    }

    function handleMouseUp(e) {
        if (isDrawing && tempArrow && currentTool === 'arrow') {
            if (Math.hypot(tempArrow.x2 - tempArrow.x1, tempArrow.y2 - tempArrow.y1) > 5) {
                arrows.push({ ...tempArrow });
            }
            tempArrow = null;
        } else if (isDragging && selectedPlayer) {
            const pos = getMousePos(canvas, e);

            if (selectedPlayer.isBenched) { // Player was dragged from bench
                selectedPlayer.isBenched = false;
                selectedPlayer.x = pos.x;
                selectedPlayer.y = pos.y;
                savePlayers();
                renderBench();
            } else { // Player was dragged on field or dropped back to bench
                const benchRect = benchContainer.getBoundingClientRect();

                if (
                    e.clientX >= benchRect.left &&
                    e.clientX <= benchRect.right &&
                    e.clientY >= benchRect.top &&
                    e.clientY <= benchRect.bottom
                ) {
                    selectedPlayer.isBenched = true;
                    savePlayers();
                    renderBench();
                }
            }
        } else if (isDragging && isDraggingBall) {
            if (typeof saveBall === 'function') { saveBall(); }
        }
        isDrawing = false;
        isDragging = false;
        isDraggingBall = false;
        selectedPlayer = null;
        draw();
    }

    // Pointer Events: unify mouse/touch
    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); handleMouseDown(e); });
    document.addEventListener('pointermove', (e) => { handleMouseMove(e); });
    document.addEventListener('pointerup', (e) => { handleMouseUp(e); });
    document.addEventListener('pointercancel', (e) => { handleMouseUp(e); });
    canvas.addEventListener('dblclick', (e) => {
        const pos = getMousePos(canvas, e);
        // Check top-most player under cursor
        for (let i = players.length - 1; i >= 0; i--) {
            const player = players[i];
            if (!player.isBenched && isMouseOverPlayer(player, pos.x, pos.y)) {
                renamePlayer(player.id);
                break;
            }
        }
    });


    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }

    function isMouseOverPlayer(player, mouseX, mouseY) {
        const dx = player.x - mouseX;
        const dy = player.y - mouseY;
        const r = ICON_SIZE / 2;
        return dx * dx + dy * dy < r * r;
    }

    function isMouseOverBall(mouseX, mouseY) {
        const dx = ball.x - mouseX;
        const dy = ball.y - mouseY;
        const r = BALL_SIZE / 2;
        return dx * dx + dy * dy < r * r;
    }

    // --- Formation Management ---
    function saveFormation() {
        const name = formationNameInput.value.trim();
        if (name) {
            if (formations[name]) {
                const ok = confirm(`Formation "${name}" exists. Overwrite?`);
                if (!ok) return;
            }
            formations[name] = {
                players: players.map(p => ({ id: p.id, x: p.x, y: p.y, isBenched: p.isBenched, team: p.team })),
                drawing: JSON.parse(JSON.stringify(drawingPaths)),
                arrows: JSON.parse(JSON.stringify(arrows)),
                cones: JSON.parse(JSON.stringify(cones))
            };
            localStorage.setItem('soccerFormations', JSON.stringify(formations));
            populateFormationSelect();
            formationNameInput.value = '';
        }
    }

    function loadFormation() {
        const name = formationSelect.value;
        if (formations[name]) {
            const formation = formations[name];
            const formationPlayers = formation.players;
            players.forEach(player => {
                const savedPlayer = formationPlayers.find(p => p.id === player.id);
                if (savedPlayer) {
                    player.x = savedPlayer.x;
                    player.y = savedPlayer.y;
                    player.isBenched = savedPlayer.isBenched;
                    if (savedPlayer.team) { player.team = savedPlayer.team; }
                }
            });

            drawingPaths = formation.drawing || [];
            arrows = formation.arrows || [];
            cones = formation.cones || [];
            renderBench();
            draw();
        }
    }

    function populateFormationSelect() {
        formationSelect.innerHTML = '';
        for (const name in formations) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            formationSelect.appendChild(option);
        }
    }

    function loadFormationsFromStorage() {
        const savedFormations = localStorage.getItem('soccerFormations');
        if (savedFormations) {
            formations = JSON.parse(savedFormations);
            populateFormationSelect();
        }
    }

    function renameFormation() {
        const current = formationSelect.value;
        if (!current || !formations[current]) return;
        const newName = prompt('Rename formation', current);
        if (newName === null) return;
        const trimmed = newName.trim();
        if (!trimmed || trimmed === current) return;
        if (formations[trimmed]) {
            const ok = confirm(`"${trimmed}" already exists. Overwrite?`);
            if (!ok) return;
        }
        formations[trimmed] = formations[current];
        delete formations[current];
        localStorage.setItem('soccerFormations', JSON.stringify(formations));
        populateFormationSelect();
        formationSelect.value = trimmed;
    }

    function deleteFormation() {
        const current = formationSelect.value;
        if (!current || !formations[current]) return;
        const ok = confirm(`Delete formation "${current}"?`);
        if (!ok) return;
        delete formations[current];
        localStorage.setItem('soccerFormations', JSON.stringify(formations));
        populateFormationSelect();
    }

    // --- Drill Designer ---
    function toggleDrawMode() {
        isDrawMode = !isDrawMode;
        toggleDrawModeBtn.textContent = `Draw Mode: ${isDrawMode ? 'On' : 'Off'}`;
    }

    function clearDrawing() {
        drawingPaths = [];
        arrows = [];
        cones = [];
        tempArrow = null;
        draw();
    }

    // --- Notes ---
    function saveNotes() {
        localStorage.setItem('soccerNotes', notesTextarea.value);
    }

    function loadNotes() {
        const savedNotes = localStorage.getItem('soccerNotes');
        if (savedNotes) {
            notesTextarea.value = savedNotes;
        }
    }

    // --- Timer ---
    let timerInterval = null;
    let timeLeft = 0;

    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function startTimer() {
        if (timerInterval) return;
        timeLeft = parseInt(timerDurationInput.value) * 60;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                alert('Time for a substitution!');
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function resetTimer() {
        stopTimer();
        timeLeft = parseInt(timerDurationInput.value) * 60;
        updateTimerDisplay();
    }

    // --- Toolbar Toggles ---
    controlsToggle.addEventListener('click', () => {
        controlsContainer.classList.toggle('hidden');
    });

    benchToggle.addEventListener('click', () => {
        benchContainer.classList.toggle('hidden');
    });

    // --- Dark Mode ---
    function switchTheme(e) {
        if (e.target.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }    
    }

    themeSwitch.addEventListener('change', switchTheme, false);

    const currentTheme = localStorage.getItem('theme') ? localStorage.getItem('theme') : null;

    if (currentTheme) {
        document.body.classList.toggle('dark-mode', currentTheme === 'dark');

        if (currentTheme === 'dark') {
            themeSwitch.checked = true;
        }
    }


    // --- Event Listeners ---
    addPlayerBtn.addEventListener('click', addPlayer);
    saveFormationBtn.addEventListener('click', saveFormation);
    formationSelect.addEventListener('change', loadFormation);
    startTimerBtn.addEventListener('click', startTimer);
    stopTimerBtn.addEventListener('click', stopTimer);
    resetTimerBtn.addEventListener('click', resetTimer);
    toggleDrawModeBtn.addEventListener('click', toggleDrawMode);
    clearDrawingBtn.addEventListener('click', clearDrawing);
    notesTextarea.addEventListener('input', saveNotes);
    if (renameFormationBtn) renameFormationBtn.addEventListener('click', renameFormation);
    if (deleteFormationBtn) deleteFormationBtn.addEventListener('click', deleteFormation);
    if (toolFreehandBtn) toolFreehandBtn.addEventListener('click', () => setTool('freehand'));
    if (toolArrowBtn) toolArrowBtn.addEventListener('click', () => setTool('arrow'));
    if (toolConeBtn) toolConeBtn.addEventListener('click', () => setTool('cone'));


    // --- Initial Setup ---
    resizeCanvas();
    // Ball persistence helpers and default position
    function centerBall() {
        ball.x = canvas.width / 2;
        ball.y = canvas.height / 2;
    }
    function saveBall() {
        try { localStorage.setItem('soccerBall', JSON.stringify(ball)); } catch {}
    }
    function loadBall() {
        try {
            const saved = localStorage.getItem('soccerBall');
            if (saved) { ball = JSON.parse(saved); }
        } catch {}
        if (!ball.x && !ball.y) { centerBall(); }
    }
    centerBall();
    loadPlayers();
    renderBench();
    loadFormationsFromStorage();
    loadNotes();
    loadBall();
    setTool('freehand');
    function setTool(t) {
        currentTool = t;
        [toolFreehandBtn, toolArrowBtn, toolConeBtn].forEach(btn => {
            if (!btn) return;
            const active = (btn.id === `tool-${t}`);
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }
});
