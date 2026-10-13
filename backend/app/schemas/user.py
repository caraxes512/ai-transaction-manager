from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def bcrypt_limit(cls, v: str) -> str:
        if len(v.encode()) > 72:
            raise ValueError("Password must be at most 72 bytes")
        return v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
