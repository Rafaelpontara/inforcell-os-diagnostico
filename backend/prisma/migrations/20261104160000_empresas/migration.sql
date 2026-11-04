-- Separação dos dados por empresa. Os dados existentes passam a ser da empresa "Inforcell".

-- CreateTable
CREATE TABLE `empresas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(120) NOT NULL,
    `telefone` VARCHAR(20) NULL,
    `ultimoNumeroOS` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Colunas opcionais durante a migração dos dados
ALTER TABLE `usuarios` ADD COLUMN `empresaId` INTEGER NULL;
ALTER TABLE `clientes` ADD COLUMN `empresaId` INTEGER NULL;
ALTER TABLE `equipamentos` ADD COLUMN `empresaId` INTEGER NULL;
ALTER TABLE `base_conhecimento` ADD COLUMN `empresaId` INTEGER NULL;
ALTER TABLE `ordens_servico` ADD COLUMN `empresaId` INTEGER NULL,
    ADD COLUMN `numero` INTEGER NULL;

-- Empresa dona dos dados já cadastrados, criada só se houver dados
INSERT INTO `empresas` (`nome`, `ultimoNumeroOS`, `updatedAt`)
SELECT 'Inforcell', COALESCE((SELECT MAX(`id`) FROM `ordens_servico`), 0), CURRENT_TIMESTAMP(3)
FROM DUAL
WHERE EXISTS (SELECT 1 FROM `usuarios`)
   OR EXISTS (SELECT 1 FROM `clientes`)
   OR EXISTS (SELECT 1 FROM `base_conhecimento`);

UPDATE `usuarios` SET `empresaId` = (SELECT MIN(`id`) FROM `empresas`);
UPDATE `clientes` SET `empresaId` = (SELECT MIN(`id`) FROM `empresas`);
UPDATE `equipamentos` SET `empresaId` = (SELECT MIN(`id`) FROM `empresas`);
UPDATE `base_conhecimento` SET `empresaId` = (SELECT MIN(`id`) FROM `empresas`);
UPDATE `ordens_servico` SET `empresaId` = (SELECT MIN(`id`) FROM `empresas`), `numero` = `id`;

-- Agora as colunas passam a ser obrigatórias
ALTER TABLE `usuarios` MODIFY `empresaId` INTEGER NOT NULL;
ALTER TABLE `clientes` MODIFY `empresaId` INTEGER NOT NULL;
ALTER TABLE `equipamentos` MODIFY `empresaId` INTEGER NOT NULL;
ALTER TABLE `base_conhecimento` MODIFY `empresaId` INTEGER NOT NULL;
ALTER TABLE `ordens_servico` MODIFY `empresaId` INTEGER NOT NULL,
    MODIFY `numero` INTEGER NOT NULL;

-- O CPF passa a ser único dentro de cada empresa
DROP INDEX `clientes_cpf_key` ON `clientes`;
CREATE UNIQUE INDEX `clientes_empresaId_cpf_key` ON `clientes`(`empresaId`, `cpf`);

-- CreateIndex
CREATE UNIQUE INDEX `ordens_servico_empresaId_numero_key` ON `ordens_servico`(`empresaId`, `numero`);

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_empresaId_fkey` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `clientes` ADD CONSTRAINT `clientes_empresaId_fkey` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `equipamentos` ADD CONSTRAINT `equipamentos_empresaId_fkey` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ordens_servico` ADD CONSTRAINT `ordens_servico_empresaId_fkey` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `base_conhecimento` ADD CONSTRAINT `base_conhecimento_empresaId_fkey` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
