FROM node:18-bullseye

WORKDIR /app-node

ENV PORT=5000
ENV SQL_DATABASE=drogueria
ENV SQL_DATABASE2=ss
ENV SQL_SCHEMA=DRO_UNI
ENV SQL_SCHEMA2=DRO_UNI
ENV SQL_USER=SA
ENV SQL_PASSWORD=Houdelot777$
ENV SQL_HOST=127.0.0.1
ENV JWT_SECRET=mundoCruel
ENV JWT_SECRETRESET=masterReset
ENV EMAIL=carlosrobertovelasquez@gmail.com
ENV EMAIL_PASSWORD=yofynxhcvnkolozd
ENV HOST=localhost
ENV SSL=N


COPY . .
 

RUN npm install

EXPOSE 5000

CMD [ "npm","start" ]



