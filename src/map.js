export const TILE_FLOOR = 0;
export const TILE_WALL = 1;

export class GameMap {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = [];
        this.entities = []; // Items and Monsters reside here
        this.init();
    }

    init() {
        // If passed in constructor, use them. Else default.
        this.width = this.width || 30;
        this.height = this.height || 20;

        this.grid = [];
        this.rooms = [];
        this.tiles = [];
        this.entities = [];

        // 1. Fill with walls
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(TILE_WALL);
            }
            this.grid.push(row);
        }

        // 2. BSP Generation
        const root = { x: 1, y: 1, w: this.width - 2, h: this.height - 2 };
        const leafs = [];
        this.splitSpace(root, leafs);

        // 3. Create Rooms in Leafs
        // To create "more corridors", we avoid filling the entire leaf.
        // We pick a random size between min(6) and leaf size.
        for (const leaf of leafs) {
            // Randomize room size within leaf
            // Ensure at least 4x4 or so
            const minSize = 4;

            // Random width between min and (leaf.w - 2)
            // We leave padding for walls/corridors
            const rw = Math.floor(Math.random() * (leaf.w - minSize - 2)) + minSize;
            const rh = Math.floor(Math.random() * (leaf.h - minSize - 2)) + minSize;

            // Center the room roughly or random position
            const rx = Math.floor(Math.random() * (leaf.w - rw - 1)) + leaf.x + 1;
            const ry = Math.floor(Math.random() * (leaf.h - rh - 1)) + leaf.y + 1;

            if (rw > 2 && rh > 2) {
                const room = { x: rx, y: ry, w: rw, h: rh };
                this.createRoom(room);
                this.rooms.push(room);
            }
        }

        // 4. Connect Rooms (Corridors)
        // Connect previous to next (Spanning tree)
        for (let i = 0; i < this.rooms.length - 1; i++) {
            this.connectRooms(this.rooms[i], this.rooms[i + 1]);
        }

        // 5. Add Extra "Braiding" / Random Connections
        // To create loops and "more corridors"
        const extraConnections = Math.floor(this.rooms.length * 0.5);
        for (let i = 0; i < extraConnections; i++) {
            const r1 = this.rooms[Math.floor(Math.random() * this.rooms.length)];
            const r2 = this.rooms[Math.floor(Math.random() * this.rooms.length)];
            if (r1 !== r2) {
                this.connectRooms(r1, r2);
            }
        }

        // Explored grid
        this.explored = Array(this.height).fill().map(() => Array(this.width).fill(false));
    }

    splitSpace(rect, leafs) {
        // Stop if too small
        if (rect.w < 8 || rect.h < 8) { // Minimum partition size
            leafs.push(rect);
            return;
        }

        // Split logic
        const splitH = Math.random() > 0.5;
        const max = (splitH ? rect.h : rect.w) - 4; // Minus min size
        if (max < 4) {
            leafs.push(rect);
            return;
        }

        const split = Math.floor(Math.random() * (max - 4)) + 4; // Split point

        if (splitH) {
            // Horizontal split (Top / Bottom)
            const top = { x: rect.x, y: rect.y, w: rect.w, h: split };
            const bottom = { x: rect.x, y: rect.y + split, w: rect.w, h: rect.h - split };
            this.splitSpace(top, leafs);
            this.splitSpace(bottom, leafs);
        } else {
            // Vertical split (Left / Right)
            const left = { x: rect.x, y: rect.y, w: split, h: rect.h };
            const right = { x: rect.x + split, y: rect.y, w: rect.w - split, h: rect.h };
            this.splitSpace(left, leafs);
            this.splitSpace(right, leafs);
        }
    }

    createRoom(room) {
        for (let y = room.y; y < room.y + room.h; y++) {
            for (let x = room.x; x < room.x + room.w; x++) {
                if (y < this.height - 1 && x < this.width - 1 && y > 0 && x > 0) {
                    this.grid[y][x] = TILE_FLOOR;
                }
            }
        }
    }

    createH_Tunnel(x1, x2, y) {
        // Ensure y is within bounds
        if (y < 1 || y >= this.height - 1) return;

        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            if (x > 0 && x < this.width - 1) {
                this.grid[y][x] = TILE_FLOOR;
            }
        }
    }

    createV_Tunnel(y1, y2, x) {
        // Ensure x is within bounds
        if (x < 1 || x >= this.width - 1) return;

        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            if (y > 0 && y < this.height - 1) {
                this.grid[y][x] = TILE_FLOOR;
            }
        }
    }

    getCenter(room) {
        return {
            x: Math.floor(room.x + room.w / 2),
            y: Math.floor(room.y + room.h / 2)
        };
    }


    setExplored(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.explored[y][x] = true;
        }
    }

    isExplored(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            return this.explored[y][x];
        }
        return false;
    }

    isWall(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return true;
        return this.grid[y][x] === TILE_WALL;
    }

    // Get entity at position (excluding player)
    getEntityAt(x, y) {
        return this.entities.find(e => e.x === x && e.y === y);
    }

    removeEntity(entity) {
        this.entities = this.entities.filter(e => e !== entity);
    }

    addEntity(entity) {
        this.entities.push(entity);
    }

    connectRooms(roomA, roomB) {
        const centerA = this.getCenter(roomA);
        const centerB = this.getCenter(roomB);

        // Coin flip for tunnel direction or preference based on proximity
        if (Math.random() > 0.5) {
            this.createH_Tunnel(centerA.x, centerB.x, centerA.y);
            this.createV_Tunnel(centerA.y, centerB.y, centerB.x);
        } else {
            this.createV_Tunnel(centerA.y, centerB.y, centerA.x);
            this.createH_Tunnel(centerA.x, centerB.x, centerB.y);
        }
    }
    getRoomAt(x, y) {
        return this.rooms.find(r =>
            x >= r.x && x < r.x + r.w &&
            y >= r.y && y < r.y + r.h
        );
    }
}
