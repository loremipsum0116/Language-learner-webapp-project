const _ = require('lodash');
const { prisma } = require('../lib/prismaClient');

const BATCH = 10;

/** stage 0 카드를 10개씩 잘라 SessionBatch 생성 */
async function createFlashBatches(userId) {
    const pool = await prisma.sRSCard.findMany({
        where: { userId, active: true, stage: 0 },
        orderBy: { id: 'asc' }
    });

    const batches = _.chunk(pool, BATCH);
    for (let i = 0; i < batches.length; i++) {
        await prisma.sessionBatch.create({
            data: {
                userId,
                order: i + 1,
                cards: batches[i].map(c => ({
                    srsCardId: c.id,
                    vocabId: c.itemId,
                    incorrect: 0
                }))
            }
        });
    }
}

module.exports = { createFlashBatches };
