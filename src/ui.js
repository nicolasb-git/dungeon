import { TILE_WALL, TILE_FLOOR } from './map.js';

export class UI {
    constructor() {
        this.gridEl = document.getElementById('game-grid');
        this.logEl = document.getElementById('game-log');

        // Stats
        this.lifeVal = document.getElementById('stat-life-val');
        this.barLife = document.getElementById('bar-life');
        this.hungerVal = document.getElementById('stat-hunger-val');
        this.barHunger = document.getElementById('bar-hunger');
        this.levelVal = document.getElementById('stat-level-val');
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

                    // STATUS HIERARCHY: Invulnerable > Critical > Starving
                    const isInvuln = (player.isInvulnerable && player.isInvulnerable()) || player.invulnerableTurns > 0;
                    const isCritical = (player.life / player.maxLife) < 0.2;
                    const isStarving = (player.hunger / player.maxHunger) < 0.2;

                    if (isInvuln) {
                        span.classList.add('invulnerable');
                    } else if (isCritical) {
                        span.classList.add('critical');
                    } else if (isStarving) {
                        span.classList.add('starving');
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

        // Hunger
        this.hungerVal.textContent = `${player.hunger}/${player.maxHunger}`;
        const hungerPct = (player.hunger / player.maxHunger) * 100;
        this.barHunger.style.width = `${hungerPct}%`;

        // XP
        this.xpVal.textContent = `${player.xp}/${player.nextLevelXp}`;
        const xpPct = (player.xp / player.nextLevelXp) * 100;
        this.barXp.style.width = `${xpPct}%`;

        // Power & Depth & Level
        this.levelVal.textContent = player.level;
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
                if (item.itemType === 'food' || item.itemType === 'potion' || item.itemType === 'gem') {
                    // Create consumption button
                    const btn = document.createElement('button');
                    let btnText = "Use";
                    if (item.itemType === 'food') btnText = "Eat";
                    if (item.itemType === 'potion') btnText = "Drink";

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

    showGameOver(message, onRestart) {
        this.messageOverlay.style.display = 'flex';
        this.modalTitle.textContent = "Game Over";
        this.modalMsg.textContent = message;
        this.modalBtn.onclick = () => {
            this.messageOverlay.style.display = 'none';
            onRestart();
        };
    }
}
