-- Inspection v3: campos climáticos, colônia expandida e tarefas vinculadas

-- Novos campos climáticos (temperatura já existia)
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS humidity_pct     NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS precipitation_mm NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS sky_condition    VARCHAR(30)
    CHECK (sky_condition IN ('sunny', 'partly_cloudy', 'cloudy'));

-- Campo de tarefas vinculadas (desnormalizado para sync offline)
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS tasks JSONB DEFAULT '[]';

-- Tabela normalizada de tarefas (para relatórios e queries relacionais)
CREATE TABLE IF NOT EXISTS inspection_tasks (
  id                  SERIAL PRIMARY KEY,
  inspection_local_id VARCHAR(36) NOT NULL
    REFERENCES inspections(local_id) ON DELETE CASCADE,
  task_label          VARCHAR(255) NOT NULL,
  custom_text         TEXT DEFAULT '',
  due_date            DATE,
  assignee_name       VARCHAR(150) DEFAULT '',
  priority            VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'urgent')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inspection_tasks_inspection_idx
  ON inspection_tasks(inspection_local_id);

CREATE INDEX IF NOT EXISTS inspection_tasks_due_date_idx
  ON inspection_tasks(due_date ASC)
  WHERE due_date IS NOT NULL;
