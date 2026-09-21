import uuid

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import SessionDep
from app.models import Meeting, Participant
from app.schemas import MeetingCreate, MeetingRead

router = APIRouter(prefix="/meetings", tags=["meetings"])


async def _get_meeting(session: AsyncSession, meeting_id: uuid.UUID) -> Meeting:
    meeting = await session.scalar(
        select(Meeting).options(selectinload(Meeting.participants)).where(Meeting.id == meeting_id)
    )
    if meeting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    return meeting


@router.get("", response_model=list[MeetingRead])
async def list_meetings(session: SessionDep) -> list[Meeting]:
    result = await session.scalars(
        select(Meeting)
        .options(selectinload(Meeting.participants))
        .order_by(Meeting.starts_at, Meeting.created_at)
    )
    return list(result)


@router.get("/{meeting_id}", response_model=MeetingRead)
async def get_meeting(meeting_id: uuid.UUID, session: SessionDep) -> Meeting:
    return await _get_meeting(session, meeting_id)


@router.post("", response_model=MeetingRead, status_code=status.HTTP_201_CREATED)
async def create_meeting(payload: MeetingCreate, session: SessionDep) -> Meeting:
    participants: list[Participant] = []
    if payload.participant_ids:
        found = await session.scalars(
            select(Participant).where(Participant.id.in_(payload.participant_ids))
        )
        participants = list(found)
        unknown = set(payload.participant_ids) - {p.id for p in participants}
        if unknown:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"Unknown participant ids: {', '.join(sorted(str(u) for u in unknown))}",
            )

    meeting = Meeting(
        title=payload.title,
        description=payload.description,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        place=payload.place,
        participants=participants,
    )
    session.add(meeting)
    await session.commit()
    return await _get_meeting(session, meeting.id)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(meeting_id: uuid.UUID, session: SessionDep) -> Response:
    meeting = await session.get(Meeting, meeting_id)
    if meeting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    await session.delete(meeting)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
