import { TILE_WALL, TILE_FLOOR } from './map.js';

export class UI {
    constructor() {
        this.gridEl = document.getElementById('game-grid');
        this.logEl = document.getElementById('game-log');

        // Stats
        this.lifeVal = document.getElementById('stat-life-val');
        this.barLife = document.getElementById('bar-life');
        this.staminaVal = document.getElementById('stat-stamina-val');
        this.barStamina = document.getElementById('bar-stamina');
        this.levelVal = document.getElementById('stat-level-val');
        this.classVal = document.getElementById('stat-class-val'); // New binding
        this.xpVal = document.getElementById('stat-xp-val');
        this.barXp = document.getElementById('bar-xp');
        this.powerVal = document.getElementById('val-power');
        this.powerLabel = document.getElementById('stat-power-val'); // Fix: Bind the label too

        // Inventory
        this.invList = document.getElementById('inventory-list');
        // Overlays
        this.messageOverlay = document.getElementById('message-overlay');
        this.modalTitle = document.getElementById('modal-title');
        this.modalMsg = document.getElementById('modal-msg');
        this.modalBtn = document.getElementById('modal-restart');

        // Status Effects
        this.statusEffects = document.getElementById('status-effects');
    }

    initGrid(width, height) {
        this.gridEl.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
        this.gridEl.style.gridTemplateRows = `repeat(${height}, 1fr)`;

        // Save dimensions for resize handler
        this.gridWidth = width;
        this.gridHeight = height;

        // JS-Driven Aspect Ratio (The Nuclear Option)
        // CSS aspect-ratio can fail in flex containers with sub-pixel rendering.
        // We will calculate exact pixel sizes.
        const fitGrid = () => {
            const container = this.gridEl.parentElement;
            const availW = container.clientWidth - 32; // -padding
            const availH = container.clientHeight - 32;

            // Calculate max tile size that fits both dims
            const tileW = Math.floor(availW / width);
            const tileH = Math.floor(availH / height);
            const tileSize = Math.max(1, Math.min(tileW, tileH));

            // Apply exact size
            this.gridEl.style.width = `${tileSize * width}px`;
            this.gridEl.style.height = `${tileSize * height}px`;

            // Dynamic Font Size for Crispness (approx 75% of tile)
            // Using Math.floor ensures we snap to integer pixels
            this.gridEl.style.fontSize = `${Math.floor(tileSize * 0.75)}px`;

            // Remove aspect-ratio to let pixel size take over
            this.gridEl.style.aspectRatio = 'auto';
        };

        // Initialize and bind
        window.addEventListener('resize', fitGrid);
        // Call immediately/soon to settle layout
        setTimeout(fitGrid, 0);

        this.gridEl.innerHTML = '';
        this.tiles = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                this.gridEl.appendChild(tile);
                this.tiles.push(tile);
            }
        }
    }

    drawMap(map, player, fov) {
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const index = y * map.width + x;
                const tileEl = this.tiles[index];

                // Reset classes
                tileEl.className = 'tile';
                tileEl.textContent = '';

                const key = `${x},${y}`;
                const isVisible = fov && fov.has(key);
                const isExplored = map.isExplored(x, y);

                const entity = map.getEntityAt(x, y);

                // DEBUG: RENDER PLAYER ALWAYS
                if (player.x === x && player.y === y) {
                    const span = document.createElement('span');
                    span.textContent = player.symbol;
                    span.className = 'entity-player';
                    // Ensure player is visible against black/FOW
                    span.style.zIndex = 100;
                    // span.style.filter = "drop-shadow(0 0 5px white)"; REMOVED FOR SHARPNESS
                    span.style.textShadow = "none"; // Ensure no shadow

                    // STATUS HIERARCHY: Paralyzed > Invulnerable > Critical > Starving
                    // Use the isParalyzed() method consistently to ensure accurate state
                    const isParalyzed = player.isParalyzed ? player.isParalyzed() : false;
                    const isInvuln = player.isInvulnerable ? player.isInvulnerable() : false;
                    const isCritical = (player.life / player.maxLife) < 0.2;
                    const isStarving = player.hunger !== undefined && player.maxHunger !== undefined && (player.hunger / player.maxHunger) < 0.2;

                    // Only add classes if the condition is true (don't add if false)
                    if (isParalyzed) {
                        span.classList.add('paralyzed');
                    } else if (isInvuln) {
                        span.classList.add('invulnerable');
                    } else if (isCritical) {
                        span.classList.add('critical');
                    } else if (isStarving) {
                        span.classList.add('starving');
                    }

                    if (player.isPoxed && player.isPoxed()) {
                        span.classList.add('poxed');
                    }

                    tileEl.appendChild(span);

                    // Also clear FOW on player tile visually so it's not dark
                    tileEl.classList.remove('fog-unexplored');
                    tileEl.classList.add('floor');
                }

                if (isVisible) {
                    // Visible State
                    if (map.grid[y][x] === TILE_WALL) {
                        tileEl.classList.add('wall');
                    } else {
                        tileEl.classList.add('floor');
                    }

                    if (entity) {
                        const span = document.createElement('span');
                        span.textContent = entity.symbol;
                        span.className = `entity-${entity.type}`;
                        tileEl.appendChild(span);
                    }
                } else if (isExplored) {
                    // Explored but hidden (Fog)
                    tileEl.classList.add('fog-explored');
                    if (map.grid[y][x] === TILE_WALL) {
                        tileEl.classList.add('wall');
                    } else {
                        tileEl.classList.add('floor');
                    }
                } else {
                    // Unexplored (shroud)
                    tileEl.classList.add('fog-unexplored');
                }
            }
        }
    }

    updateStats(player, depth) {
        // Life
        this.lifeVal.textContent = `${player.life}/${player.maxLife}`;
        const lifePct = (player.life / player.maxLife) * 100;
        this.barLife.style.width = `${lifePct}%`;

        // Stamina
        this.staminaVal.textContent = `${Math.ceil(player.stamina)}/${player.maxStamina}`;
        const staminaPct2 = (player.stamina / player.maxStamina) * 100;
        this.barStamina.style.width = `${staminaPct2}%`;

        // XP
        this.xpVal.textContent = `${player.xp}/${player.nextLevelXp}`;
        const xpPct = (player.xp / player.nextLevelXp) * 100;
        this.barXp.style.width = `${xpPct}%`;

        // Power & Depth & Level
        this.levelVal.textContent = player.level;
        if (this.classVal) this.classVal.textContent = player.name; // Update Class Name
        // Using player.level which is now the source of truth
        this.powerVal.innerHTML = `${player.power} <span style="font-size:0.8rem; color:var(--text-muted); margin-left:10px;">Depth ${depth || 1}</span>`;
        if (this.powerLabel) this.powerLabel.textContent = player.power; // Fix: Update label
    }

    log(message, type = 'info') {
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        div.textContent = `> ${message}`;
        this.logEl.prepend(div);

        // Keep log size sane
        if (this.logEl.children.length > 20) {
            this.logEl.lastElementChild.remove();
        }
    }

    updateInventory(inventory, onUse) {
        console.log("DEBUG: UI updating inventory. Count:", inventory ? inventory.length : 'null');
        this.invList.innerHTML = '';
        if (inventory.length === 0) {
            this.invList.innerHTML = '<li class="empty-slot">Empty</li>';
            return;
        }

        inventory.forEach((item) => {
            const li = document.createElement('li');

            let text = "";
            let action = "";

            if (item.itemType === 'gold') {
                text = `<span>${item.symbol} ${item.name}</span> <span class="highlight">${item.value}</span>`;
            } else {
                text = `<span>${item.symbol} ${item.name} (x${item.quantity})</span>`;
                if (item.itemType === 'food' || item.itemType === 'potion' || item.itemType === 'gem' || item.itemType === 'equipment') {
                    // Create consumption button
                    const btn = document.createElement('button');
                    let btnText = "Use";
                    if (item.itemType === 'food') btnText = "Eat";
                    if (item.itemType === 'potion') btnText = "Drink";
                    if (item.itemType === 'equipment') btnText = "Equip";

                    btn.textContent = btnText;
                    btn.className = "action-btn";
                    btn.onclick = () => onUse(item);
                    action = btn;
                }
            }

            li.innerHTML = `<div class="item-info">${text}</div>`;
            if (action) {
                const div = document.createElement('div');
                div.appendChild(action);
                li.appendChild(div);
            }

            this.invList.appendChild(li);
        });
    }

    showGameOver(message, score, onRestart) {
        this.messageOverlay.style.display = 'flex';
        this.modalTitle.textContent = "You Have Died";

        this.modalMsg.innerHTML = `
            <p style="color:var(--text-muted); margin-bottom:1rem;">${message}</p>
            <p style="font-size:1.5rem; color:var(--accent-color); margin-bottom:1rem;">SCORE: ${score}</p>
            <div style="margin: 1rem 0;">
                <input type="text" id="hero-name" placeholder="Enter your name" maxlength="12" style="
                    padding:0.5rem; 
                    font-family:var(--font-heading); 
                    font-size:1.2rem; 
                    background: #000; 
                    color:white; 
                    border:1px solid #555; 
                    text-align:center;
                ">
            </div>
        `;

        this.modalBtn.textContent = "Submit & Restart";

        const submitHandler = () => {
            const nameInput = document.getElementById('hero-name');
            const name = nameInput ? nameInput.value.trim() : "Anonymous";
            this.messageOverlay.style.display = 'none';
            if (onRestart) onRestart(name || "Anonymous");
        };

        this.modalBtn.onclick = submitHandler;

        // Auto focus & Enter key
        setTimeout(() => {
            const input = document.getElementById('hero-name');
            if (input) {
                input.focus();
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') submitHandler();
                });
            }
        }, 100);
    }

    updateEquipment(player, onSlotClick) {
        // Loop through all slots in the HTML
        const slots = document.querySelectorAll('.equip-slot[data-slot]');
        slots.forEach(slot => {
            const key = slot.dataset.slot;
            const item = player.equipment[key];

            slot.innerHTML = ''; // Clear previous

            // Remove old listeners (by cloning? No, simple re-assignment of onclick is enough if not using addEventListener)
            // Better: just set onclick property which overwrites previous
            slot.onclick = () => {
                if (onSlotClick) onSlotClick(key);
            };

            if (item) {
                slot.textContent = item.symbol;
                slot.title = `${item.name} (${key}) +${item.value} Power\nClick to Upgrade (500 Gold)`;
                slot.classList.add('equipped');
                slot.style.cursor = "pointer"; // Indicate clickable

                // Badge for power
                if (item.value) {
                    const badge = document.createElement('span');
                    badge.className = 'equip-badge';
                    badge.textContent = `+${item.value}`;
                    slot.appendChild(badge);
                }
            } else {
                slot.textContent = '';
                // Optional: Set default icon based on key?
                // For now leave empty
                slot.title = key; // Reset title
                slot.classList.remove('equipped');
                slot.style.cursor = "default";
            }
        });
    }

    updateStatusEffects(player) {
        if (!this.statusEffects) return;

        this.statusEffects.innerHTML = ''; // Clear existing icons

        // Check for paralysis
        if (player.isParalyzed && player.isParalyzed()) {
            const icon = document.createElement('span');
            icon.className = 'status-icon paralyzed';
            icon.textContent = '🧊';
            icon.title = 'Paralyzed';
            this.statusEffects.appendChild(icon);
        }

        // Check for invulnerability
        // Use the isInvulnerable() method consistently to ensure accurate state
        const isInvulnerable = player.isInvulnerable ? player.isInvulnerable() : false;
        if (isInvulnerable) {
            const icon = document.createElement('span');
            icon.className = 'status-icon invulnerable';
            icon.textContent = '🛡️';
            icon.title = 'Invulnerable';
            this.statusEffects.appendChild(icon);
        }

        // Check for Pox
        if (player.isPoxed && player.isPoxed()) {
            const icon = document.createElement('span');
            icon.className = 'status-icon poxed';
            icon.textContent = '🦠';
            icon.title = 'Pox (Power Halved)';
            this.statusEffects.appendChild(icon);
        }
    }
}
