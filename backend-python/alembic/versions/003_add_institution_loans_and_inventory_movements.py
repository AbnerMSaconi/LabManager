"""add_institution_loans_and_inventory_movements

Revision ID: 003
Revises: 266d171c8cf4
Create Date: 2026-03-25
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "266d171c8cf4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table("institution_loans",
        sa.Column("id",                 sa.Integer(),   primary_key=True),
        sa.Column("item_model_id",      sa.Integer(),   sa.ForeignKey("item_models.id"), nullable=False),
        sa.Column("requester_name",     sa.String(255), nullable=False),
        sa.Column("quantity_delivered", sa.Integer(),   nullable=False),
        sa.Column("quantity_returned",  sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("return_date",        sa.Date(),      nullable=True),
        sa.Column("no_return_reason",   sa.Text(),      nullable=True),
        sa.Column("status",             sa.String(30),  nullable=False, server_default="em_aberto"),
        sa.Column("damage_observation", sa.Text(),      nullable=True),
        sa.Column("is_operational",     sa.Boolean(),   nullable=True),
        sa.Column("created_by_id",      sa.Integer(),   sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at",         sa.DateTime(),  nullable=False, server_default=sa.text("GETDATE()")),
        sa.Column("returned_at",        sa.DateTime(),  nullable=True),
    )

    op.create_table("inventory_movements",
        sa.Column("id",             sa.Integer(),   primary_key=True),
        sa.Column("item_model_id",  sa.Integer(),   sa.ForeignKey("item_models.id"), nullable=False),
        sa.Column("action",         sa.String(50),  nullable=False),
        sa.Column("quantity",       sa.Integer(),   nullable=False),
        sa.Column("operator_id",    sa.Integer(),   sa.ForeignKey("users.id"), nullable=False),
        sa.Column("target",         sa.String(255), nullable=False),
        sa.Column("reservation_id", sa.Integer(),   sa.ForeignKey("reservations.id"), nullable=True),
        sa.Column("loan_id",        sa.Integer(),   sa.ForeignKey("institution_loans.id"), nullable=True),
        sa.Column("observation",    sa.Text(),      nullable=True),
        sa.Column("created_at",     sa.DateTime(),  nullable=False, server_default=sa.text("GETDATE()")),
    )


def downgrade() -> None:
    op.drop_table("inventory_movements")
    op.drop_table("institution_loans")
