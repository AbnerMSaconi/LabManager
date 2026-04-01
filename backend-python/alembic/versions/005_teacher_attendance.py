"""teacher_attendance - tabela de registro de presença de professores

Revision ID: 005
Revises: 004
Create Date: 2026-03-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "teacher_attendances",
        sa.Column("id",               sa.Integer(),     primary_key=True),
        sa.Column("reservation_id",   sa.Integer(),     sa.ForeignKey("reservations.id"), nullable=False, unique=True),
        sa.Column("status",           sa.String(30),    nullable=False),
        sa.Column("registered_by_id", sa.Integer(),     sa.ForeignKey("users.id"), nullable=True),
        sa.Column("registered_at",    sa.DateTime(),    nullable=False),
    )


def downgrade() -> None:
    op.drop_table("teacher_attendances")
