from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Read from environment variables or a local .env file. No secrets live in the code.
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    database_url: str = ""
    allowed_origins: str = "http://localhost:5173"  # comma separated
    clinic_timezone: str = "Asia/Kolkata"
    clinic_name: str = "Leaf & Plate Nutrition"
    slot_minutes: int = 30
    day_start: str = "09:00"          # first slot of the day
    day_end: str = "17:00"            # last slot ENDS here
    working_days: str = "0,1,2,3,4,5"  # Monday=0 ... Sunday=6 (clients can book these days)
    booking_horizon_days: int = 30
    min_lead_minutes: int = 60        # clients cannot book a slot starting sooner than this
    admin_passcode: str = ""          # optional; if empty, dashboard API is open (see README)
    whatsapp_country_code: str = "91"
    client_app_url: str = ""          # optional; added to WhatsApp reminder text

    @property
    def origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def working_day_set(self) -> set[int]:
        return {int(d) for d in self.working_days.split(",") if d.strip() != ""}


@lru_cache
def get_settings() -> Settings:
    return Settings()
