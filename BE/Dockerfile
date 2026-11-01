# syntax=docker/dockerfile:1
# Nightcrawlers backend. Build context: BE/
# - build: Maven runs on the build host's platform (the jar is platform independent, no QEMU).
# - jre:   jdeps + jlink on the target platform: a trimmed Java runtime with only the modules
#          the application uses (keeps the image small for the GHCR free quota).
# - runtime: Ubuntu base (bash for the healthcheck), unprivileged user.

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

FROM eclipse-temurin:25-jdk AS jre
COPY --from=build /extracted /extracted
# Modules found by jdeps, plus the ones loaded only reflectively or by service lookup
# (DNS/JNDI, management, locales for Italian messages, zipfs, crypto providers).
RUN modules="$(jdeps --ignore-missing-deps --print-module-deps --multi-release 25 -q \
        --class-path '/extracted/lib/*' /extracted/app.jar)" \
    && echo "jdeps: $modules" \
    && jlink --add-modules "$modules,jdk.crypto.ec,jdk.naming.dns,jdk.localedata,jdk.zipfs,jdk.management,java.instrument,jdk.unsupported" \
        --include-locales=en,it --strip-debug --no-man-pages --no-header-files \
        --compress=zip-0 --output /jre

FROM ubuntu:24.04
RUN groupadd --system app && useradd --system --gid app --no-create-home --shell /usr/sbin/nologin app
ENV JAVA_HOME=/opt/java \
    PATH=/opt/java/bin:$PATH \
    LANG=C.UTF-8 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
COPY --from=jre /jre /opt/java
WORKDIR /app
COPY --from=build /extracted/lib/ ./lib/
COPY --from=build /extracted/app.jar ./app.jar
USER app
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
    CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/8080 && printf 'GET /actuator/health HTTP/1.0\r\n\r\n' >&3 && grep -q '\"status\":\"UP\"' <&3"]
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
