import { GeneEngine } from './gene_engine.js';

export class GeneLab extends GeneEngine {
    addChromosome(pattern, color, x = 0, y = 0, z = 0) {
        const numBalls = (pattern.match(/o/g) || []).length;
        z = numBalls - 9;
        const balls = [];
        let currentBall = this.addBall(x, y, z, color);
        balls.push(currentBall);

        let i = 1;
        while (i < pattern.length) {
            if (pattern[i] === '-' && pattern[i + 1] === 'o') {
                currentBall = this.addStickBall(currentBall);
                balls.push(currentBall);
                i += 2;
            } else if (pattern[i] === 'o') {
                currentBall = this.addConnectedBall(currentBall);
                balls.push(currentBall);
                i++;
            } else {
                i++;
            }
        }

        const chromosome = {
            balls: balls,
            pattern: pattern,
            color: color
        };

        return chromosome;
    }

    async duplicateChromosome(chromosome, offsetX = 3, offsetY = 0, offsetZ = 0) {
        const newBalls = [];
        const pattern = chromosome.pattern;
        const color = chromosome.color;

        const firstBall = chromosome.balls[0];
        const newFirst = this.popBall(
            firstBall.position.x + offsetX,
            firstBall.position.y + offsetY,
            firstBall.position.z + offsetZ,
            color
        );
        newBalls.push(newFirst);

        await new Promise(resolve => setTimeout(resolve, 100));

        let currentBall = newFirst;
        let ballIndex = 1;
        let i = 1;

        while (i < pattern.length) {
            if (pattern[i] === '-' && pattern[i + 1] === 'o') {
                currentBall = await this.popStickBall(currentBall, 0);
                newBalls.push(currentBall);
                i += 2;
                ballIndex++;
            } else if (pattern[i] === 'o') {
                currentBall = await new Promise((resolve) => {
                    setTimeout(() => {
                        const child = this.popBall(
                            currentBall.position.x,
                            currentBall.position.y - 2,
                            currentBall.position.z,
                            color
                        );

                        const dx = child.position.x - currentBall.position.x;
                        const dy = child.position.y - currentBall.position.y;
                        const dz = child.position.z - currentBall.position.z;
                        const restLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

                        this.connections.push({
                            parent: currentBall,
                            child: child,
                            restLength: restLength,
                            line: null
                        });

                        resolve(child);
                    }, 0);
                });
                newBalls.push(currentBall);
                i++;
                ballIndex++;
            } else {
                i++;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return {
            balls: newBalls,
            pattern: pattern,
            color: color
        };
    }

    async formTetrad(chromo1, chromo2, spacing = 0.5, duration = 2000) {
        const startTime = Date.now();

        const initialPositions1 = chromo1.balls.map(ball => ({
            x: ball.position.x,
            y: ball.position.y,
            z: ball.position.z
        }));

        const initialPositions2 = chromo2.balls.map(ball => ({
            x: ball.position.x,
            y: ball.position.y,
            z: ball.position.z
        }));

        const centerX = (initialPositions1[0].x + initialPositions2[0].x) / 2;

        chromo1.balls.forEach(ball => ball.userData.pinned = true);
        chromo2.balls.forEach(ball => ball.userData.pinned = true);

        return new Promise((resolve) => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = this.easeInOutCubic(progress);

                chromo1.balls.forEach((ball, i) => {
                    const initial = initialPositions1[i];
                    const targetX = centerX - spacing;
                    ball.position.x = initial.x + (targetX - initial.x) * eased;
                    ball.userData.oldX = ball.position.x;
                });

                chromo2.balls.forEach((ball, i) => {
                    const initial = initialPositions2[i];
                    const targetX = centerX + spacing;
                    ball.position.x = initial.x + (targetX - initial.x) * eased;
                    ball.userData.oldX = ball.position.x;
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    chromo1.balls.forEach(ball => ball.userData.pinned = false);
                    chromo2.balls.forEach(ball => ball.userData.pinned = false);
                    resolve();
                }
            };

            animate();
        });
    }

    easeInOutCubic(x) {
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    findStickBall(chromosome) {
        for (let ball of chromosome.balls) {
            const connection = this.connections.find(conn =>
                (conn.parent === ball || conn.child === ball) && conn.line !== null
            );
            if (connection) {
                return connection.parent;
            }
        }
        return chromosome.balls[0];
    }

    async formTetrad4(chromo1, chromo2, chromo3, chromo4, spacing = 3, duration = 2000) {
        const chromos = [chromo1, chromo2, chromo3, chromo4];
        const stickBalls = chromos.map(c => this.findStickBall(c));

        const initials = chromos.map(c => c.balls.map(ball => ({
            x: ball.position.x, y: ball.position.y, z: ball.position.z
        })));

        const stickInitials = stickBalls.map(sb => ({ x: sb.position.x, y: sb.position.y, z: sb.position.z }));

        const centerX = stickInitials.reduce((s, p) => s + p.x, 0) / 4;
        const centerY = stickInitials.reduce((s, p) => s + p.y, 0) / 4;
        const centerZ = stickInitials.reduce((s, p) => s + p.z, 0) / 4;
        const zSpread = spacing * 0.6;

        const targets = [
            { x: centerX - spacing * 0.5, y: centerY, z: centerZ - zSpread * 0.5 },
            { x: centerX + spacing * 0.5, y: centerY, z: centerZ - zSpread * 0.5 },
            { x: centerX - spacing * 0.5, y: centerY, z: centerZ + zSpread * 0.5 },
            { x: centerX + spacing * 0.5, y: centerY, z: centerZ + zSpread * 0.5 },
        ];

        chromos.forEach(c => c.balls.forEach(ball => ball.userData.pinned = true));

        return new Promise((resolve) => {
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = this.easeInOutCubic(progress);

                chromos.forEach((chromo, ci) => {
                    const stickInit = stickInitials[ci];
                    const target = targets[ci];
                    const dx = (target.x - stickInit.x) * eased;
                    const dy = (target.y - stickInit.y) * eased;
                    const dz = (target.z - stickInit.z) * eased;

                    chromo.balls.forEach((ball, bi) => {
                        const init = initials[ci][bi];
                        ball.position.x = init.x + dx;
                        ball.position.y = init.y + dy;
                        ball.position.z = init.z + dz;
                        ball.userData.oldX = ball.position.x;
                        ball.userData.oldY = ball.position.y;
                        ball.userData.oldZ = ball.position.z;
                    });
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    const tetradId = Date.now();
                    chromos.forEach(c => c.balls.forEach(ball => {
                        ball.userData.pinned = false;
                        ball.userData.tetradId = tetradId;
                    }));
                    resolve();
                }
            };
            animate();
        });
    }
}
