ALTER TABLE `proyectos_grado`
  ADD COLUMN `area_personalizada` VARCHAR(150) NULL AFTER `id_area`,
  ADD COLUMN `observacion_revision` VARCHAR(1000) NULL AFTER `area_personalizada`;
