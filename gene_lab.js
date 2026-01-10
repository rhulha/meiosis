import { GeneEngine } from './gene_engine.js';

export class GeneLab extends GeneEngine {
    addChromosome(pattern, color, x = 0, y = 0, z = 0) {
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
        const startTime = Date.now();

        const stickBall1 = this.findStickBall(chromo1);
        const stickBall2 = this.findStickBall(chromo2);
        const stickBall3 = this.findStickBall(chromo3);
        const stickBall4 = this.findStickBall(chromo4);

        const initial1 = { x: stickBall1.position.x, y: stickBall1.position.y, z: stickBall1.position.z };
        const initial2 = { x: stickBall2.position.x, y: stickBall2.position.y, z: stickBall2.position.z };
        const initial3 = { x: stickBall3.position.x, y: stickBall3.position.y, z: stickBall3.position.z };
        const initial4 = { x: stickBall4.position.x, y: stickBall4.position.y, z: stickBall4.position.z };

        const centerX = (initial1.x + initial2.x + initial3.x + initial4.x) / 4;
        const centerY = (initial1.y + initial2.y + initial3.y + initial4.y) / 4;

        stickBall1.userData.pinned = true;
        stickBall2.userData.pinned = true;
        stickBall3.userData.pinned = true;
        stickBall4.userData.pinned = true;

        return new Promise((resolve) => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = this.easeInOutCubic(progress);

                const target1X = centerX - spacing * 1.5;
                const target1Y = centerY;
                stickBall1.position.x = initial1.x + (target1X - initial1.x) * eased;
                stickBall1.position.y = initial1.y + (target1Y - initial1.y) * eased;
                stickBall1.userData.oldX = stickBall1.position.x;
                stickBall1.userData.oldY = stickBall1.position.y;

                const target2X = centerX - spacing * 0.5;
                const target2Y = centerY;
                stickBall2.position.x = initial2.x + (target2X - initial2.x) * eased;
                stickBall2.position.y = initial2.y + (target2Y - initial2.y) * eased;
                stickBall2.userData.oldX = stickBall2.position.x;
                stickBall2.userData.oldY = stickBall2.position.y;

                const target3X = centerX + spacing * 0.5;
                const target3Y = centerY;
                stickBall3.position.x = initial3.x + (target3X - initial3.x) * eased;
                stickBall3.position.y = initial3.y + (target3Y - initial3.y) * eased;
                stickBall3.userData.oldX = stickBall3.position.x;
                stickBall3.userData.oldY = stickBall3.position.y;

                const target4X = centerX + spacing * 1.5;
                const target4Y = centerY;
                stickBall4.position.x = initial4.x + (target4X - initial4.x) * eased;
                stickBall4.position.y = initial4.y + (target4Y - initial4.y) * eased;
                stickBall4.userData.oldX = stickBall4.position.x;
                stickBall4.userData.oldY = stickBall4.position.y;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    stickBall1.userData.pinned = false;
                    stickBall2.userData.pinned = false;
                    stickBall3.userData.pinned = false;
                    stickBall4.userData.pinned = false;
                    resolve();
                }
            };

            animate();
        });
    }
}
