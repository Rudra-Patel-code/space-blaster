// Game Configuration
const CONFIG = {
    weapons: {
        light: {
            damage: 10,
            color: "white",
            audio: new Audio("/audio/light.wav"),
            speed: 6,
        },
        heavy: {
            damage: 25,
            color: "cyan",
            audio: new Audio("/audio/heavy.mp3"),
            speed: 4,
        },
        lazer: {
            damage: 50,
            color: "cyan",
            audio: new Audio("/audio/lazerbeam.wav"),
            speed: 30,
            cooldown: 1.5 * 60 * 1000,
        },
    },
    player: {
        radius: 10,
        color: "white",
        speed: 5,
        shieldDuration: 20000,
        trailLength: 10,
    },
    enemy: {
        minRadius: 10,
        maxRadius: 70,
        color: "hsl(0, 100%, 50%)",
        baseSpeed: 0.5,
        driftFactor: 0.05,
    },
    powerUps: {
        types: {
            bullets: {
                chance: 0.55,
                color: "rgba(229, 245, 39, 0.8)",
                image: "./assests/bullet.png",
            },
            health: {
                chance: 0.225,
                color: "rgba(245, 39, 39, 0.8)",
                image: "./assests/heart.png",
            },
            shield: {
                chance: 0.225,
                color: "rgba(192, 192, 192, 0.8)",
                image: "./assests/shield.png",
            },
        },
        radius: 15,
    },
    supabase: {
        url: import.meta.env.VITE_SUPABASE_URL,
        key: import.meta.env.VITE_SUPABASE_KEY,
    },
    starLayers: [
        {
            count: 100,
            speed: 0.1,
            sizeRange: [0.5, 1.0],
            alphaRange: [0.2, 0.4],
        },
        {
            count: 100,
            speed: 0.2,
            sizeRange: [0.8, 1.2],
            alphaRange: [0.3, 0.6],
        },
        {
            count: 100,
            speed: 0.3,
            sizeRange: [1.0, 1.5],
            alphaRange: [0.5, 0.8],
        },
    ],
};

// Game Initialization
const canvas = document.createElement("canvas");
document.querySelector(".myGame").appendChild(canvas);
const form = document.querySelector("form");
const scoreBoard = document.querySelector(".scoreBoard");
const leaderboard = document.getElementById("leaderboard");
const timeHUD = document.getElementById("timeHUD");

let startTime = null;
let diffculity = 1;
let playerScore = 0;
let heavyWeaponCount = 6;
let lastLazerShot = 0;
let displayedHealth = 100;
let username = "";

// Load assets
const spaceShipImage = new Image();
spaceShipImage.src = "/assests/spaceship.png";
const bulletIcon = new Image();
bulletIcon.src = "/assests/bullet.png";
const KILL_SOUND = new Audio("/audio/kill.mp3");
const HURT_SOUND = new Audio("/audio/hurt.mp3");

// Setup canvas
canvas.width = innerWidth;
canvas.height = innerHeight;
const context = canvas.getContext("2d");

// Supabase client
const client = window.supabase.createClient(
    CONFIG.supabase.url,
    CONFIG.supabase.key
);

// Game Objects
class Player {
    constructor(x, y, health) {
        this.x = x;
        this.y = y;
        this.health = health;
        this.radius = CONFIG.player.radius;
        this.color = CONFIG.player.color;
        this.speed = CONFIG.player.speed;
        this.shield = false;
        this.shieldEndTime = 0;
        this.trail = [];
        this.trailLength = CONFIG.player.trailLength;
    }

    draw() {
        this.drawTrail();
        this.drawPlayer();
        if (this.shield) {
            this.drawShieldEffect();
            this.drawShieldTimer();
        }
    }

    drawTrail() {
        this.trail.push({ x: this.x, y: this.y, alpha: 0.4 });
        if (this.trail.length > this.trailLength) this.trail.shift();

        this.trail.forEach((point, i) => {
            context.save();
            context.globalAlpha = point.alpha * (i / this.trailLength);
            context.beginPath();
            context.arc(point.x, point.y, this.radius - 2, 0, Math.PI * 2);
            context.fillStyle = this.color;
            context.fill();
            context.restore();
        });
    }

    drawPlayer() {
        const pulse = Math.sin(Date.now() / 250) * 1.5;
        const currentRadius = this.radius + pulse;

        context.save();
        context.shadowColor = this.color;
        context.shadowBlur = 25;
        context.beginPath();
        context.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        context.fillStyle = this.color;
        context.fill();
        context.restore();

        const gradient = context.createRadialGradient(
            this.x,
            this.y,
            2,
            this.x,
            this.y,
            currentRadius
        );
        gradient.addColorStop(0, "white");
        gradient.addColorStop(1, this.color);

        context.beginPath();
        context.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        context.fillStyle = gradient;
        context.fill();
    }

    drawShieldEffect() {
        const shieldTimeLeft = Math.max(0, this.shieldEndTime - Date.now());
        const alpha = (Math.sin(Date.now() / 150) + 1) / 4 + 0.2;
        const shieldRadius =
            this.radius + 20 + Math.sin(Date.now() / 250) * 1.5;

        context.save();
        context.beginPath();
        context.arc(this.x, this.y, shieldRadius, 0, Math.PI * 2);
        context.strokeStyle = `rgba(173, 216, 230, ${alpha})`;
        context.lineWidth = 4;
        context.setLineDash([10, 6]);
        context.lineDashOffset = -Date.now() / 40;
        context.stroke();
        context.restore();

        for (let i = 0; i < 4; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const dist = shieldRadius + Math.random() * 10;
            const px = this.x + Math.cos(angle) * dist;
            const py = this.y + Math.sin(angle) * dist;

            context.beginPath();
            context.arc(px, py, 1.5, 0, Math.PI * 2);
            context.fillStyle = "rgba(173,216,230,0.6)";
            context.fill();
        }
    }

    drawShieldTimer() {
        const circleRadius = 40;
        const circleX = 100;
        const circleY = canvas.height - circleRadius - 100;

        const remaining = Math.max(0, this.shieldEndTime - Date.now());
        const seconds = (remaining / 1000).toFixed(1);
        const percent = remaining / 20000; // 20s shield duration

        if (remaining <= 0) return;

        const outerGlow = `rgba(0, 255, 255, ${
            0.5 + 0.5 * Math.sin(Date.now() / 200)
        })`;

        // Outer ring with glow
        context.save();
        context.beginPath();
        context.arc(circleX, circleY, circleRadius + 6, 0, Math.PI * 2);
        context.strokeStyle = outerGlow;
        context.lineWidth = 4;
        context.shadowBlur = 10;
        context.shadowColor = "#00ffff";
        context.stroke();
        context.restore();

        // Background circle
        context.beginPath();
        context.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
        context.fillStyle = "rgba(20, 20, 20, 0.6)";
        context.fill();

        // Countdown arc
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + 2 * Math.PI * percent;
        context.beginPath();
        context.arc(circleX, circleY, circleRadius, startAngle, endAngle);
        context.strokeStyle = "#00ffff";
        context.lineWidth = 6;
        context.stroke();

        // Time text
        context.fillStyle = "white";
        context.font = "bold 16px 'Orbitron', monospace";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(`${seconds}s`, circleX, circleY);
    }

    drawHealthBar() {
        const x = canvas.width - 320;
        const y = 20;
        const barWidth = 300;
        const barHeight = 24;

        displayedHealth += (this.health - displayedHealth) * 0.1;
        const healthRatio = Math.max(0, displayedHealth / 100);

        const gradient = context.createLinearGradient(x, y, x + barWidth, y);
        if (this.health > 70) {
            gradient.addColorStop(0, "#00ff99");
            gradient.addColorStop(1, "#007755");
        } else if (this.health > 40) {
            gradient.addColorStop(0, "#ffee00");
            gradient.addColorStop(1, "#ff9900");
        } else {
            gradient.addColorStop(0, "#ff4444");
            gradient.addColorStop(1, "#990000");
        }

        context.fillStyle = "rgba(255, 255, 255, 0.08)";
        context.fillRect(x, y, barWidth, barHeight);

        context.save();
        context.shadowColor = gradient;
        context.shadowBlur = 10;
        context.fillStyle = gradient;
        context.fillRect(x, y, barWidth * healthRatio, barHeight);
        context.restore();

        const borderPulse = this.health < 30 && Date.now() % 1000 < 500;
        context.lineWidth = 2;
        context.strokeStyle = borderPulse ? "red" : "#aaa";
        context.strokeRect(x, y, barWidth, barHeight);

        context.fillStyle = "#fff";
        context.font = "bold 14px 'Orbitron', monospace";
        context.fillText("HP", x - 30, y + barHeight - 5);
    }

    move(velocityX, velocityY) {
        this.x += velocityX;
        this.y += velocityY;

        this.x = Math.max(
            this.radius,
            Math.min(canvas.width - this.radius, this.x)
        );
        this.y = Math.max(
            this.radius,
            Math.min(canvas.height - this.radius, this.y)
        );
    }

    getDamage(damage) {
        if (!this.shield) {
            HURT_SOUND.currentTime = 0;
            HURT_SOUND.play();
            this.health = Math.max(0, this.health - damage);
        }
    }

    activateShield(duration = CONFIG.player.shieldDuration) {
        this.shield = true;
        this.shieldEndTime = Date.now() + duration;
    }
}

class Enemy {
    constructor(x, y, radius, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = CONFIG.enemy.color;
        this.velocity = velocity;
        this.hasPowerup = Math.random() <= 0.15;
        this.damage = Math.max(5, Math.floor(this.radius / 2));
        this.trail = [];
    }

    draw() {
        const pulse = Math.sin(Date.now() / 200) * 2;
        const currentRadius = this.radius + pulse;

        context.beginPath();
        context.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        context.fillStyle = this.color;
        context.fill();

        for (let i = 0; i < 4; i++) {
            const angle = ((Date.now() / 200 + i) * Math.PI) / 2;
            const px = this.x + Math.cos(angle) * (currentRadius + 8);
            const py = this.y + Math.sin(angle) * (currentRadius + 8);

            context.beginPath();
            context.arc(px, py, 4, 0, Math.PI * 2);
            context.fillStyle = "rgba(255, 125, 125, 0.4)";
            context.fill();
        }
    }

    update() {
        this.draw();
        this.moveTowardPlayer();
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }

    moveTowardPlayer() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        const distance = Math.hypot(player.x - this.x, player.y - this.y);

        const driftFactor = CONFIG.enemy.driftFactor;
        const baseSpeed = CONFIG.enemy.baseSpeed * diffculity;

        this.velocity.x =
            Math.cos(angle) * baseSpeed + (Math.random() - 0.5) * driftFactor;
        this.velocity.y =
            Math.sin(angle) * baseSpeed + (Math.random() - 0.5) * driftFactor;

        if (distance < 50) {
            this.velocity.x *= 0.5;
            this.velocity.y *= 0.5;
        }
    }

    takeDamage(damage) {
        this.radius = Math.max(0, Math.floor(this.radius - damage));
    }
}

class Projectile {
    constructor(x, y, radius, color, velocity, damage) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.damage = damage;
    }

    draw() {
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fillStyle = this.color;
        context.fill();
    }

    update() {
        this.draw();
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }

    isOutOfBounds() {
        return (
            this.x - this.radius < 0 ||
            this.x + this.radius > canvas.width ||
            this.y - this.radius < 0 ||
            this.y + this.radius > canvas.height
        );
    }
}

class LazerBeam extends Projectile {
    constructor(x, y) {
        super(
            x,
            y,
            0,
            CONFIG.weapons.lazer.color,
            { x: CONFIG.weapons.lazer.speed, y: 0 },
            CONFIG.weapons.lazer.damage
        );
        this.width = 200;
        this.height = canvas.height;
    }

    draw() {
        context.fillStyle = this.color;
        context.fillRect(this.x, this.y, this.width, this.height);
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.radius = CONFIG.powerUps.radius;
        this.type = type;
        this.image = new Image();
        this.image.src = CONFIG.powerUps.types[type].image;
        this.color = CONFIG.powerUps.types[type].color;
        this.imageSize = this.radius * (type === "bullets" ? 5 : 2.5);
    }

    draw() {
        const floatOffset = Math.sin(Date.now() / 500) * 4;
        const pulse = (Math.sin(Date.now() / 200) + 1) * 0.5 + 0.3;
        const ringRadius = this.radius + 16;

        context.save();
        context.beginPath();
        context.arc(this.x, this.y + floatOffset, ringRadius, 0, Math.PI * 2);
        context.lineWidth = 3;
        context.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
        context.setLineDash([6, 4]);
        context.lineDashOffset = -Date.now() / 20;
        context.stroke();
        context.restore();

        for (let i = 0; i < 4; i++) {
            const angle = ((Date.now() / 200 + i) * Math.PI) / 2;
            const px = this.x + Math.cos(angle) * ringRadius;
            const py = this.y + floatOffset + Math.sin(angle) * ringRadius;

            context.beginPath();
            context.arc(px, py, 1.5, 0, Math.PI * 2);
            context.fillStyle = "rgba(255,255,255,0.5)";
            context.fill();
        }

        if (this.image.complete) {
            context.drawImage(
                this.image,
                this.x - this.imageSize / 2,
                this.y + floatOffset - this.imageSize / 2,
                this.imageSize,
                this.imageSize
            );
        }
    }

    checkCollision(player) {
        const distance = Math.hypot(this.x - player.x, this.y - player.y);
        return distance < this.radius + player.radius;
    }
}

class Particle {
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.alpha = 1;
    }

    draw() {
        context.save();
        context.globalAlpha = this.alpha;
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fillStyle = this.color;
        context.fill();
        context.restore();
    }

    update() {
        this.draw();
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.01;
        return this.alpha <= 0;
    }
}

// Game State
const player = new Player(canvas.width / 2, canvas.height / 2, 100);
const enemies = [];
const projectiles = [];
const particles = [];
const powerUps = [];
const lazerBeams = [];
const stars = [];

// Initialize stars
CONFIG.starLayers.forEach((layer) => {
    for (let i = 0; i < layer.count; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius:
                Math.random() * (layer.sizeRange[1] - layer.sizeRange[0]) +
                layer.sizeRange[0],
            alpha:
                Math.random() * (layer.alphaRange[1] - layer.alphaRange[0]) +
                layer.alphaRange[0],
            speed: layer.speed,
        });
    }
});

// Game Functions
function spawnEnemies() {
    setInterval(() => {
        const radius =
            Math.random() * (CONFIG.enemy.maxRadius - CONFIG.enemy.minRadius) +
            CONFIG.enemy.minRadius;

        let x, y;
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? -radius : canvas.width + radius;
            y = Math.random() * canvas.height;
        } else {
            x = Math.random() * canvas.width;
            y = Math.random() < 0.5 ? -radius : canvas.height + radius;
        }

        const angle = Math.atan2(player.y - y, player.x - x);
        const velocity = {
            x: Math.cos(angle) / radius,
            y: Math.sin(angle) / radius,
        };

        enemies.push(new Enemy(x, y, radius, velocity));
    }, 1000 * (1 / diffculity));
}

function createExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push(
            new Particle(x, y, Math.random() * 4, color, {
                x: (Math.random() - 0.5) * 6,
                y: (Math.random() - 0.5) * 6,
            })
        );
    }
}

function createPowerUp(enemy) {
    if (!enemy.hasPowerup) return;

    const random = Math.random();
    let type;

    if (random < CONFIG.powerUps.types.bullets.chance) {
        type = "bullets";
    } else if (
        random <
        CONFIG.powerUps.types.bullets.chance +
            CONFIG.powerUps.types.health.chance
    ) {
        type = "health";
    } else {
        type = "shield";
    }

    powerUps.push(new PowerUp(enemy.x, enemy.y, type));
}

function updateScore(amount = 10) {
    playerScore = Math.max(0, playerScore + amount);
    if (amount > 0) {
        KILL_SOUND.currentTime = 0;
        KILL_SOUND.play();
    }
    scoreBoard.innerHTML = `Score: ${playerScore}<br><span style="font-size: 0.9em; color: #00ffff; text-shadow: 0 0 8px #00ffff;">@${username}</span>`;
}

function drawHeavyWeaponCount() {
    const barX = canvas.width - 120;
    const barY = 20;
    const barHeight = 24;
    const offsetY = 16;
    const iconSize = 32;
    const padding = 12;
    const countX = barX;
    const countY = barY + barHeight + offsetY;

    context.save();
    context.beginPath();
    context.roundRect(
        countX - padding,
        countY - padding,
        iconSize + 80,
        iconSize + 20,
        12
    );
    context.fillStyle = "rgba(0, 0, 0, 0.5)";
    context.fill();
    context.shadowBlur = 10;
    context.shadowColor = "#ffff55";
    context.strokeStyle = "#ffaa00";
    context.lineWidth = 2;
    context.stroke();
    context.restore();

    context.drawImage(bulletIcon, countX, countY, iconSize, iconSize);
    context.fillStyle = "white";
    context.font = "bold 20px 'Orbitron', monospace";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(
        `x ${heavyWeaponCount}`,
        countX + iconSize + 20,
        countY + iconSize / 2
    );
}

function drawLazerCooldown() {
    const circleRadius = 36;
    const centerX = canvas.width - circleRadius - 60;
    const centerY = canvas.height - circleRadius - 60;
    const timeSinceLastShot = Date.now() - lastLazerShot;
    const cooldownProgress = Math.min(
        timeSinceLastShot / CONFIG.weapons.lazer.cooldown,
        1
    );
    const ready = cooldownProgress >= 1;

    context.beginPath();
    context.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    context.fillStyle = "rgba(255, 255, 255, 0.05)";
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = ready ? "#00ffcc" : "#ff4444";
    context.stroke();

    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + cooldownProgress * Math.PI * 2;
    context.beginPath();
    context.arc(centerX, centerY, circleRadius - 5, startAngle, endAngle);
    context.strokeStyle = ready ? "#00ffcc" : "#ff4444";
    context.lineWidth = 5;
    context.shadowColor = ready ? "#00ffcc" : "#ff4444";
    context.shadowBlur = ready ? 10 : 0;
    context.stroke();
    context.shadowBlur = 0;

    if (ready) {
        context.beginPath();
        context.arc(centerX, centerY, circleRadius - 12, 0, Math.PI * 2);
        context.fillStyle = "rgba(0, 255, 204, 0.15)";
        context.fill();
    }

    context.fillStyle = "#fff";
    context.font = "bold 20px 'Orbitron', monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("⚡", centerX, centerY - 3);

    if (!ready) {
        const remainingSec = (
            (CONFIG.weapons.lazer.cooldown - timeSinceLastShot) /
            1000
        ).toFixed(1);
        context.font = "10px 'Orbitron', monospace";
        context.fillText(`${remainingSec}s`, centerX, centerY + 14);
    }
}

function shootProjectile(weaponType, x, y) {
    const angle = Math.atan2(y - player.y, x - player.x);
    const weapon = CONFIG.weapons[weaponType];

    const projectile = new Projectile(
        player.x,
        player.y,
        5,
        weapon.color,
        {
            x: Math.cos(angle) * weapon.speed,
            y: Math.sin(angle) * weapon.speed,
        },
        weapon.damage
    );

    projectiles.push(projectile);
    weapon.audio.currentTime = 0;
    weapon.audio.play();

    if (weaponType === "heavy") {
        heavyWeaponCount--;
    }
}

function shootLazer() {
    const currentTime = Date.now();
    if (currentTime - lastLazerShot < CONFIG.weapons.lazer.cooldown) return;

    lastLazerShot = currentTime;
    CONFIG.weapons.lazer.audio.currentTime = 0;
    CONFIG.weapons.lazer.audio.play();
    lazerBeams.push(new LazerBeam(0, 0));
}

async function generateUsername(maxRetries = 5) {
    const adjectives = ["Swift", "Lazy", "Epic", "Silent", "Brave", "Funky"];
    const nouns = ["Falcon", "Tiger", "Wizard", "Ninja", "Dragon", "Samurai"];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const randomAdjective =
            adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNum = Math.floor(Math.random() * 1000);
        const generatedName = `${randomAdjective}${randomNoun}${randomNum}`;

        const { data } = await client
            .from("leaderboard")
            .select("name")
            .eq("name", generatedName)
            .limit(1);

        if (!data || data.length === 0) {
            localStorage.setItem("username", generatedName);
            return generatedName;
        }
    }

    const fallbackName = `Player-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem("username", fallbackName);
    return fallbackName;
}

async function fetchTopScores() {
    const { data, error } = await client
        .from("leaderboard")
        .select("name, score")
        .order("score", { ascending: false })
        .limit(5);

    if (error) {
        console.error("Failed to fetch leaderboard:", error);
        return [];
    }
    return data;
}

async function renderLeaderboard() {
    const leaderboardEl = document.getElementById("leaderboard");
    const listEl = document.getElementById("leaderboardList");
    const scores = await fetchTopScores();

    listEl.innerHTML = "";
    scores.forEach((entry, index) => {
        const li = document.createElement("li");
        li.textContent = `${index + 1}. ${entry.name} - ${entry.score}`;
        if (entry.name === username) li.classList.add("highlight");
        listEl.appendChild(li);
    });

    leaderboardEl.style.display = "block";
    gsap.from("#leaderboard", {
        opacity: 0,
        y: -30,
        duration: 0.5,
        ease: "back.out(1.7)",
    });
}

function gameOverHandler() {
    leaderboard.style.display = "block";
    const gameOver = document.createElement("div");
    const gameOverBtn = document.createElement("button");
    const highScore = document.createElement("div");

    const oldHighScore = localStorage.getItem("highScore") || 0;
    const newHighScore = Math.max(oldHighScore, playerScore);
    localStorage.setItem("highScore", newHighScore);
    highScore.innerHTML = `High Score: ${newHighScore}`;

    (async () => {
        if (username) {
            try {
                const { data: existing } = await client
                    .from("leaderboard")
                    .select("score")
                    .eq("name", username)
                    .maybeSingle();

                if (!existing || playerScore > existing.score) {
                    await client
                        .from("leaderboard")
                        .upsert([{ name: username, score: playerScore }], {
                            onConflict: "name",
                        });
                }
            } catch (err) {
                console.error("Error submitting score:", err);
            }
        }
    })();

    gameOverBtn.textContent = "Play Again";
    gameOverBtn.onclick = () => location.reload();
    gameOver.classList.add("gameover");
    gameOver.appendChild(highScore);
    gameOver.appendChild(gameOverBtn);
    document.body.appendChild(gameOver);

    gsap.fromTo(
        ".gameover",
        { opacity: 0, y: -40 },
        { opacity: 1, y: 0, duration: 1, ease: "power2.out" }
    );
}

// Game Loop
let velocityX = 0;
let velocityY = 0;
const friction = 0.9;
const keys = { w: false, a: false, s: false, d: false };

function animation() {
    const animationId = requestAnimationFrame(animation);

    // Update timer
    if (startTime) {
        const elapsed = Date.now() - startTime;
        const mins = Math.floor(elapsed / 60000);
        const secs = Math.floor((elapsed % 60000) / 1000);
        const ms = Math.floor((elapsed % 1000) / 10);
        timeHUD.innerHTML = `${String(mins).padStart(2, "0")}:${String(
            secs
        ).padStart(2, "0")}<span class="ms">${String(ms).padStart(
            2,
            "0"
        )}</span>`;
    }

    // Clear and draw background
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw stars
    stars.forEach((star) => {
        star.x -= star.speed;
        if (star.x < 0) {
            star.x = canvas.width;
            star.y = Math.random() * canvas.height;
        }
        context.beginPath();
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        context.fill();
    });

    // Game over check
    if (player.health <= 0) {
        cancelAnimationFrame(animationId);
        gameOverHandler();
        return;
    }

    // Update shield state
    if (player.shield && Date.now() > player.shieldEndTime) {
        player.shield = false;
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].update()) {
            particles.splice(i, 1);
        }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (enemy.radius <= 0) {
            enemies.splice(i, 1);
            continue;
        }

        enemy.update();

        // Check player collision
        const distanceFromPlayer = Math.hypot(
            player.x - enemy.x,
            player.y - enemy.y
        );
        if (distanceFromPlayer - enemy.radius - player.radius < 1) {
            if (player.shield) {
                // Award points when shield kills enemy
                updateScore(10);
                KILL_SOUND.currentTime = 0;
                KILL_SOUND.play();
                if (enemy.hasPowerup) createPowerUp(enemy);
            } else {
                player.getDamage(enemy.damage);
            }

            createExplosion(enemy.x, enemy.y, enemy.color, enemy.radius * 2);
            enemies.splice(i, 1);
            continue;
        }

        // Check lazer collision
        for (let j = lazerBeams.length - 1; j >= 0; j--) {
            const distance = lazerBeams[j].x - enemy.x;
            if (Math.abs(distance) <= 200) {
                updateScore(10);
                KILL_SOUND.currentTime = 0;
                KILL_SOUND.play();
                if (enemy.hasPowerup) createPowerUp(enemy);
                createExplosion(
                    enemy.x,
                    enemy.y,
                    enemy.color,
                    enemy.radius * 2
                );
                enemies.splice(i, 1);
                break;
            }
        }

        // Check projectile collision
        for (let j = projectiles.length - 1; j >= 0; j--) {
            const distance = Math.hypot(
                projectiles[j].x - enemy.x,
                projectiles[j].y - enemy.y
            );
            if (distance - enemy.radius - projectiles[j].radius < 1) {
                HURT_SOUND.currentTime = 0;
                HURT_SOUND.play();

                if (
                    enemy.radius - projectiles[j].damage <=
                    projectiles[j].damage + 5
                ) {
                    updateScore(10);
                    KILL_SOUND.currentTime = 0;
                    KILL_SOUND.play();
                    createExplosion(
                        enemy.x,
                        enemy.y,
                        enemy.color,
                        enemy.radius * 2
                    );
                    if (enemy.hasPowerup) createPowerUp(enemy);
                    enemies.splice(i, 1);
                } else {
                    gsap.to(enemy, {
                        radius: enemy.radius - projectiles[j].damage,
                        duration: 0.2,
                        ease: "power2.out",
                    });
                }
                projectiles.splice(j, 1);
                break;
            }
        }
    }

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        projectiles[i].update();
        if (projectiles[i].isOutOfBounds()) {
            projectiles.splice(i, 1);
        }
    }

    // Update lazer beams
    for (let i = lazerBeams.length - 1; i >= 0; i--) {
        lazerBeams[i].update();
        if (lazerBeams[i].x > canvas.width) {
            lazerBeams.splice(i, 1);
        }
    }

    // Update powerups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        powerUps[i].draw();
        if (powerUps[i].checkCollision(player)) {
            switch (powerUps[i].type) {
                case "health":
                    player.health = 100;
                    break;
                case "shield":
                    player.activateShield();
                    break;
                case "bullets":
                    heavyWeaponCount += 3;
                    break;
            }
            powerUps.splice(i, 1);
        }
    }

    // Draw UI
    drawLazerCooldown();
    player.draw();
    player.drawHealthBar();
    drawHeavyWeaponCount();

    // Player movement
    if (keys.w) velocityY = -player.speed;
    if (keys.s) velocityY = +player.speed;
    if (keys.a) velocityX = -player.speed;
    if (keys.d) velocityX = +player.speed;

    velocityX *= friction;
    velocityY *= friction;

    player.move(velocityX, velocityY);
}

// Event Listeners
document.querySelector("input").addEventListener("click", (e) => {
    e.preventDefault();
    form.style.display = "none";
    scoreBoard.style.display = "block";
    leaderboard.style.display = "none";
    timeHUD.style.display = "block";
    gsap.fromTo(
        ".scoreBoard",
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 1, ease: "power2.out" }
    );
    startTime = Date.now();

    scoreBoard.innerHTML = `Score: ${playerScore}<br><span style="font-size: 0.9em; color: #00ffff; text-shadow: 0 0 8px #00ffff;">@${username}</span>`;

    spawnEnemies();
});

const arrowToWASD = {
    ArrowUp: "w",
    ArrowLeft: "a",
    ArrowDown: "s",
    ArrowRight: "d",
};

addEventListener("keydown", (e) => {
    const key = arrowToWASD[e.key] || e.key;
    if (keys.hasOwnProperty(key)) {
        keys[key] = true;
    }
    if (e.key === " ") shootLazer();
});

addEventListener("keyup", (e) => {
    const key = arrowToWASD[e.key] || e.key;
    if (keys.hasOwnProperty(key)) {
        keys[key] = false;
    }
});

canvas.addEventListener("click", (e) => {
    e.preventDefault();
    shootProjectile("light", e.clientX, e.clientY);
});

canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (heavyWeaponCount > 0) {
        shootProjectile("heavy", e.clientX, e.clientY);
    }
});

addEventListener("resize", () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    player.x = innerWidth / 2;
    player.y = innerHeight / 2;
});

// Difficulty scaling
setInterval(() => {
    const rate = 1000 * (1 / diffculity);
    if (rate > 50) diffculity += 0.2;
}, 30000);

// Initialize game
(async () => {
    username = localStorage.getItem("username") || (await generateUsername());
    console.log("Your username is:", username);
    renderLeaderboard();
    animation();
})();
