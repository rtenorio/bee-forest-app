#!/bin/bash
# =============================================================================
# restore.sh — Restauração de backup do PostgreSQL via Cloudflare R2
# =============================================================================
#
# USO:
#   bash restore.sh 2025-04-07
#
# O argumento é a data do backup no formato YYYY-MM-DD.
# Se omitido, usa a data de hoje (UTC).
#
# PRÉ-REQUISITOS:
#   - aws CLI instalado e configurado com credenciais do R2
#   - postgresql-client instalado (psql, pg_restore)
#   - Variáveis de ambiente definidas (ver abaixo)
#
# VARIÁVEIS DE AMBIENTE NECESSÁRIAS:
#   DATABASE_URL          — URL de conexão com o banco destino
#                           Formato: postgres://user:password@host:5432/dbname
#   R2_ACCOUNT_ID         — ID da conta Cloudflare
#   R2_ACCESS_KEY_ID      — Access key do R2
#   R2_SECRET_ACCESS_KEY  — Secret key do R2
#   R2_BUCKET_BACKUP      — Nome do bucket (ex: bee-forest-backup)
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# 1. Determina a data do backup a restaurar
# -----------------------------------------------------------------------------
BACKUP_DATE="${1:-$(date -u +%Y-%m-%d)}"
FILENAME="backup-${BACKUP_DATE}.sql.gz"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

echo "==> Backup a restaurar: $FILENAME"
echo "==> Bucket: s3://${R2_BUCKET_BACKUP}"
echo "==> Banco destino: ${DATABASE_URL%%\?*}"  # Oculta query string com senhas
echo ""

# -----------------------------------------------------------------------------
# 2. Configurar AWS CLI para o Cloudflare R2
# -----------------------------------------------------------------------------
echo "==> Configurando credenciais do R2..."
aws configure set aws_access_key_id "$R2_ACCESS_KEY_ID"
aws configure set aws_secret_access_key "$R2_SECRET_ACCESS_KEY"
aws configure set default.region auto

# -----------------------------------------------------------------------------
# 3. Download do arquivo de backup do R2
# -----------------------------------------------------------------------------
echo "==> Baixando $FILENAME do R2..."
aws s3 cp \
  "s3://${R2_BUCKET_BACKUP}/${FILENAME}" \
  "./${FILENAME}" \
  --endpoint-url "$ENDPOINT"

echo "==> Download concluído: $(du -sh ./$FILENAME | cut -f1)"

# -----------------------------------------------------------------------------
# 4. Descompressão do arquivo
# -----------------------------------------------------------------------------
echo "==> Descomprimindo arquivo..."
SQLFILE="${FILENAME%.gz}"
gunzip -c "./$FILENAME" > "./$SQLFILE"

# -----------------------------------------------------------------------------
# 5. ATENÇÃO: Este passo apaga todos os dados do banco destino.
#    Confirme antes de prosseguir.
# -----------------------------------------------------------------------------
echo ""
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo "  AVISO: A restauração irá SOBRESCREVER o banco de dados destino."
echo "  Banco: ${DATABASE_URL%%\?*}"
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo ""
read -rp "Confirma a restauração? Digite 'sim' para continuar: " CONFIRM

if [[ "$CONFIRM" != "sim" ]]; then
  echo "Restauração cancelada."
  rm -f "./$FILENAME" "./$SQLFILE"
  exit 0
fi

# -----------------------------------------------------------------------------
# 6. Restauração com psql
#    O arquivo gerado pelo pg_dump em formato plain SQL é restaurado via psql.
#    Se o banco precisar ser recriado do zero, rode antes:
#      dropdb --if-exists nome_do_banco
#      createdb nome_do_banco
# -----------------------------------------------------------------------------
echo "==> Restaurando banco de dados..."
psql "$DATABASE_URL" < "./$SQLFILE"

echo ""
echo "==> Restauração concluída com sucesso!"

# -----------------------------------------------------------------------------
# 7. Limpeza dos arquivos temporários locais
# -----------------------------------------------------------------------------
echo "==> Removendo arquivos temporários..."
rm -f "./$FILENAME" "./$SQLFILE"

echo "==> Pronto."
