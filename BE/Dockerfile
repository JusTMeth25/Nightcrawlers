# syntax=docker/dockerfile:1
# Nightcrawlers backend. Build context: BE/
# The jar is platform independent, so the build stage runs on the build host's platform
# (no QEMU for Maven); only the runtime stage is built for the target (linux/arm64 in CD).

FROM --platform=$BUILDPLATFORM eclipse-temurin:25-jdk AS build
WORKDIR /src
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 \
    sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY src/ src/
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -B -q -DskipTests package \
    && cp target/nightcrawlers-*.jar /tmp/app.jar \
    && java -Djarmode=tools -jar /tmp/app.jar extract --destination /extracted

FROM eclipse-temurin:25-jre
# Unprivileged user; the image ships no curl/wget, the healthcheck uses bash /dev/tcp.
RUN groupadd --system app && useradd --system --gid app --no-create-home --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=build --chown=root:root /extracted/ ./
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
USER app
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
    CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/8080 && printf 'GET /actuator/health HTTP/1.0\r\n\r\n' >&3 && grep -q '\"status\":\"UP\"' <&3"]
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
