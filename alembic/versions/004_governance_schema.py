"""governance_schema - soft delete, audit logs, system backups, super_admin

Revision ID: 004
Revises: 2a59f54f7f36
Create Date: 2026-03-27
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "2a59f54f7f36"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Soft delete: adicionar deleted_at nas tabelas principais
    op.add_column("users",        sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.add_column("laboratories", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.add_column("softwares",    sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.add_column("item_models",  sa.Column("deleted_at", sa.DateTime(), nullable=True))

    # Tabela de auditoria
    op.create_table(
        "audit_logs",
        sa.Column("id",         sa.Integer(),     primary_key=True),
        sa.Column("table_name", sa.String(100),   nullable=False),
        sa.Column("record_id",  sa.Integer(),     nullable=False),
        sa.Column("old_data",   sa.Text(),        nullable=True),
        sa.Column("new_data",   sa.Text(),        nullable=True),
        sa.Column("user_id",    sa.Integer(),     sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(),    nullable=False, server_default=sa.func.now()),
    )

    # Tabela de backups
    op.create_table(
        "system_backups",
        sa.Column("id",              sa.Integer(),   primary_key=True),
        sa.Column("filename",        sa.String(255), nullable=False),
        sa.Column("created_at",      sa.DateTime(),  nullable=False, server_default=sa.func.now()),
        sa.Column("size_mb",         sa.Float(),     nullable=True),
        sa.Column("triggered_by_id", sa.Integer(),   sa.ForeignKey("users.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("system_backups")
    op.drop_table("audit_logs")
    op.drop_column("item_models",  "deleted_at")
    op.drop_column("softwares",    "deleted_at")
    op.drop_column("laboratories", "deleted_at")
    op.drop_column("users",        "deleted_at")
