"""Criação inicial de todas as tabelas

Revision ID: 001
Revises: 
Create Date: 2026-03-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table("users",
        sa.Column("id",                  sa.Integer(),     primary_key=True),
        sa.Column("registration_number", sa.String(50),    nullable=False, unique=True, index=True),
        sa.Column("hashed_password",     sa.String(255),   nullable=False),
        sa.Column("full_name",           sa.String(255),   nullable=False),
        sa.Column("role",                sa.String(30),    nullable=False, server_default="professor"),
        sa.Column("is_active",           sa.Boolean(),     nullable=False, server_default=sa.true()),
    )

    op.create_table("lesson_slots",
        sa.Column("id",         sa.Integer(),  primary_key=True),
        sa.Column("code",       sa.String(10), nullable=False, unique=True),
        sa.Column("start_time", sa.String(5),  nullable=False),
        sa.Column("end_time",   sa.String(5),  nullable=False),
    )

    op.create_table("laboratories",
        sa.Column("id",          sa.Integer(),  primary_key=True),
        sa.Column("name",        sa.String(100),nullable=False),
        sa.Column("block",       sa.String(30), nullable=False),
        sa.Column("room_number", sa.String(20), nullable=False),
        sa.Column("capacity",    sa.Integer(),  nullable=False),
        sa.Column("is_practical",sa.Boolean(),  nullable=False, server_default=sa.false()),
        sa.Column("description", sa.Text(),     nullable=True),
        sa.Column("is_active",   sa.Boolean(),  nullable=False, server_default=sa.true()),
    )

    op.create_table("softwares",
        sa.Column("id",      sa.Integer(),   primary_key=True),
        sa.Column("name",    sa.String(100), nullable=False),
        sa.Column("version", sa.String(50),  nullable=True),
    )

    op.create_table("lab_softwares",
        sa.Column("lab_id",      sa.Integer(), sa.ForeignKey("laboratories.id"), primary_key=True),
        sa.Column("software_id", sa.Integer(), sa.ForeignKey("softwares.id"),    primary_key=True),
    )

    op.create_table("hardwares",
        sa.Column("id",             sa.Integer(),   primary_key=True),
        sa.Column("name",           sa.String(100), nullable=False),
        sa.Column("specifications", sa.Text(),      nullable=True),
    )

    op.create_table("lab_hardwares",
        sa.Column("lab_id",      sa.Integer(), sa.ForeignKey("laboratories.id"), primary_key=True),
        sa.Column("hardware_id", sa.Integer(), sa.ForeignKey("hardwares.id"),    primary_key=True),
    )

    op.create_table("item_models",
        sa.Column("id",          sa.Integer(),   primary_key=True),
        sa.Column("name",        sa.String(255), nullable=False),
        sa.Column("category",    sa.String(30),  nullable=False),
        sa.Column("description", sa.Text(),      nullable=True),
        sa.Column("image_url",   sa.String(512), nullable=True),
        sa.Column("total_stock", sa.Integer(),   nullable=False, server_default="0"),
    )

    op.create_table("physical_items",
        sa.Column("id",             sa.Integer(),  primary_key=True),
        sa.Column("model_id",       sa.Integer(),  sa.ForeignKey("item_models.id"), nullable=False),
        sa.Column("patrimony_id",   sa.String(50), nullable=False, unique=True, index=True),
        sa.Column("status",         sa.String(30), nullable=False, server_default="disponivel"),
        sa.Column("current_lab_id", sa.Integer(),  sa.ForeignKey("laboratories.id"), nullable=True),
    )

    op.create_table("reservations",
        sa.Column("id",                           sa.Integer(),  primary_key=True),
        sa.Column("user_id",                      sa.Integer(),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("lab_id",                       sa.Integer(),  sa.ForeignKey("laboratories.id"), nullable=True),
        sa.Column("date",                         sa.Date(),     nullable=False),
        sa.Column("status",                       sa.String(30), nullable=False, server_default="pendente"),
        sa.Column("requested_softwares",          sa.Text(),     nullable=True),
        sa.Column("software_installation_required",sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("approved_by_id",               sa.Integer(),  sa.ForeignKey("users.id"), nullable=True),
        sa.Column("rejection_reason",             sa.Text(),     nullable=True),
        sa.Column("approval_notes",               sa.Text(),     nullable=True),
        sa.Column("created_at",                   sa.DateTime(), nullable=False, server_default=sa.text("GETDATE()")),
    )

    op.create_table("reservation_slots",
        sa.Column("reservation_id", sa.Integer(), sa.ForeignKey("reservations.id"), primary_key=True),
        sa.Column("slot_id",        sa.Integer(), sa.ForeignKey("lesson_slots.id"), primary_key=True),
    )

    op.create_table("reservation_items",
        sa.Column("id",                 sa.Integer(), primary_key=True),
        sa.Column("reservation_id",     sa.Integer(), sa.ForeignKey("reservations.id"), nullable=False),
        sa.Column("item_model_id",      sa.Integer(), sa.ForeignKey("item_models.id"),  nullable=False),
        sa.Column("physical_item_id",   sa.Integer(), sa.ForeignKey("physical_items.id"), nullable=True),
        sa.Column("quantity_requested", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("quantity_returned",  sa.Integer(), nullable=False, server_default="0"),
        sa.Column("return_status",      sa.String(30),nullable=True),
        sa.Column("damage_observation", sa.Text(),    nullable=True),
    )

    op.create_table("maintenance_tickets",
        sa.Column("id",               sa.Integer(),  primary_key=True),
        sa.Column("title",            sa.String(200),nullable=False),
        sa.Column("description",      sa.Text(),     nullable=False),
        sa.Column("lab_id",           sa.Integer(),  sa.ForeignKey("laboratories.id"), nullable=True),
        sa.Column("physical_item_id", sa.Integer(),  sa.ForeignKey("physical_items.id"), nullable=True),
        sa.Column("opened_by_id",     sa.Integer(),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("resolved_by_id",   sa.Integer(),  sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status",           sa.String(30), nullable=False, server_default="aberto"),
        sa.Column("severity",         sa.String(20), nullable=False, server_default="medio"),
        sa.Column("resolution_notes", sa.Text(),     nullable=True),
        sa.Column("created_at",       sa.DateTime(), nullable=False, server_default=sa.text("GETDATE()")),
        sa.Column("resolved_at",      sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("maintenance_tickets")
    op.drop_table("reservation_items")
    op.drop_table("reservation_slots")
    op.drop_table("reservations")
    op.drop_table("physical_items")
    op.drop_table("item_models")
    op.drop_table("lab_hardwares")
    op.drop_table("hardwares")
    op.drop_table("lab_softwares")
    op.drop_table("softwares")
    op.drop_table("laboratories")
    op.drop_table("lesson_slots")
    op.drop_table("users")
