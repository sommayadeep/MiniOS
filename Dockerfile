FROM python:3.12-slim

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc make \
    && rm -rf /var/lib/apt/lists/*

COPY . .
RUN make

CMD ["python3", "ui/app.py"]
