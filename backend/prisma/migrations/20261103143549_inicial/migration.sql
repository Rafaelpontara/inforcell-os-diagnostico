-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(120) NOT NULL,
    `email` VARCHAR(160) NOT NULL,
    `senhaHash` VARCHAR(100) NOT NULL,
    `perfil` ENUM('ADMIN', 'ATENDENTE', 'TECNICO') NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usuarios_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clientes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(120) NOT NULL,
    `cpf` VARCHAR(14) NULL,
    `telefone` VARCHAR(20) NOT NULL,
    `email` VARCHAR(160) NULL,
    `endereco` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clientes_cpf_key`(`cpf`),
    INDEX `clientes_telefone_idx`(`telefone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `equipamentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clienteId` INTEGER NOT NULL,
    `tipo` ENUM('CELULAR', 'TABLET', 'NOTEBOOK', 'DESKTOP', 'OUTRO') NOT NULL,
    `marca` VARCHAR(60) NOT NULL,
    `modelo` VARCHAR(80) NOT NULL,
    `numeroSerie` VARCHAR(80) NULL,
    `imei` VARCHAR(20) NULL,
    `cor` VARCHAR(40) NULL,
    `observacoes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `equipamentos_imei_idx`(`imei`),
    INDEX `equipamentos_numeroSerie_idx`(`numeroSerie`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ordens_servico` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clienteId` INTEGER NOT NULL,
    `equipamentoId` INTEGER NOT NULL,
    `atendenteId` INTEGER NOT NULL,
    `tecnicoId` INTEGER NULL,
    `defeitoRelatado` TEXT NOT NULL,
    `acessorios` VARCHAR(255) NULL,
    `status` ENUM('RECEBIDO', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'EM_REPARO', 'EM_TESTES', 'FINALIZADO', 'ENTREGUE', 'CANCELADO') NOT NULL DEFAULT 'RECEBIDO',
    `valorOrcamento` DECIMAL(10, 2) NULL,
    `previsaoEntrega` DATETIME(3) NULL,
    `observacoes` TEXT NULL,
    `finalizadaEm` DATETIME(3) NULL,
    `entregueEm` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ordens_servico_status_idx`(`status`),
    INDEX `ordens_servico_tecnicoId_idx`(`tecnicoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historico_status` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `osId` INTEGER NOT NULL,
    `usuarioId` INTEGER NOT NULL,
    `de` ENUM('RECEBIDO', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'EM_REPARO', 'EM_TESTES', 'FINALIZADO', 'ENTREGUE', 'CANCELADO') NULL,
    `para` ENUM('RECEBIDO', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'EM_REPARO', 'EM_TESTES', 'FINALIZADO', 'ENTREGUE', 'CANCELADO') NOT NULL,
    `observacao` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessoes_diagnostico` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `osId` INTEGER NOT NULL,
    `tecnicoId` INTEGER NOT NULL,
    `sintoma` TEXT NOT NULL,
    `status` ENUM('ATIVA', 'CONCLUIDA') NOT NULL DEFAULT 'ATIVA',
    `causasPossiveis` JSON NULL,
    `diagnosticoFinal` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `concluidaEm` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mensagens_diagnostico` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessaoId` INTEGER NOT NULL,
    `autor` ENUM('TECNICO', 'IA') NOT NULL,
    `conteudo` TEXT NOT NULL,
    `dadosEstruturados` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medicoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `osId` INTEGER NOT NULL,
    `sessaoId` INTEGER NULL,
    `pontoMedicao` VARCHAR(120) NOT NULL,
    `grandeza` VARCHAR(40) NOT NULL,
    `valor` DECIMAL(12, 4) NOT NULL,
    `unidade` VARCHAR(10) NOT NULL,
    `resultadoEsperado` VARCHAR(120) NULL,
    `avaliacao` ENUM('DENTRO_DO_ESPERADO', 'ABAIXO_DO_ESPERADO', 'ACIMA_DO_ESPERADO', 'INDEFINIDO') NOT NULL DEFAULT 'INDEFINIDO',
    `observacao` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reparos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `osId` INTEGER NOT NULL,
    `tecnicoId` INTEGER NOT NULL,
    `descricao` TEXT NOT NULL,
    `pecasUtilizadas` TEXT NULL,
    `valorFinal` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `base_conhecimento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(160) NOT NULL,
    `tipoEquipamento` ENUM('CELULAR', 'TABLET', 'NOTEBOOK', 'DESKTOP', 'OUTRO') NULL,
    `marca` VARCHAR(60) NULL,
    `modelo` VARCHAR(80) NULL,
    `sintoma` VARCHAR(255) NOT NULL,
    `conteudo` TEXT NOT NULL,
    `tags` VARCHAR(255) NULL,
    `origemOsId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `equipamentos` ADD CONSTRAINT `equipamentos_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordens_servico` ADD CONSTRAINT `ordens_servico_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordens_servico` ADD CONSTRAINT `ordens_servico_equipamentoId_fkey` FOREIGN KEY (`equipamentoId`) REFERENCES `equipamentos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordens_servico` ADD CONSTRAINT `ordens_servico_atendenteId_fkey` FOREIGN KEY (`atendenteId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordens_servico` ADD CONSTRAINT `ordens_servico_tecnicoId_fkey` FOREIGN KEY (`tecnicoId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historico_status` ADD CONSTRAINT `historico_status_osId_fkey` FOREIGN KEY (`osId`) REFERENCES `ordens_servico`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historico_status` ADD CONSTRAINT `historico_status_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessoes_diagnostico` ADD CONSTRAINT `sessoes_diagnostico_osId_fkey` FOREIGN KEY (`osId`) REFERENCES `ordens_servico`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessoes_diagnostico` ADD CONSTRAINT `sessoes_diagnostico_tecnicoId_fkey` FOREIGN KEY (`tecnicoId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensagens_diagnostico` ADD CONSTRAINT `mensagens_diagnostico_sessaoId_fkey` FOREIGN KEY (`sessaoId`) REFERENCES `sessoes_diagnostico`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicoes` ADD CONSTRAINT `medicoes_osId_fkey` FOREIGN KEY (`osId`) REFERENCES `ordens_servico`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicoes` ADD CONSTRAINT `medicoes_sessaoId_fkey` FOREIGN KEY (`sessaoId`) REFERENCES `sessoes_diagnostico`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reparos` ADD CONSTRAINT `reparos_osId_fkey` FOREIGN KEY (`osId`) REFERENCES `ordens_servico`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reparos` ADD CONSTRAINT `reparos_tecnicoId_fkey` FOREIGN KEY (`tecnicoId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
