import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createDatabaseClient} from "../packages/database/dist/index.js";
import {hashPassword} from "../packages/service-kit/dist/index.js";
import {createApp as authApp} from "../apps/auth-service/dist/app.js";
import {createApp as gatewayApp} from "../apps/api-gateway/dist/app.js";

test("clientes actualizan únicamente su cuenta y cambian contraseña de forma segura", async () => {
  const db = createDatabaseClient(), apps = [], marker = randomUUID();
  const password = "Clave anterior " + marker, newPassword = "Clave nueva " + marker;
  let client, other, admin;
  async function listen(app) {apps.push(app); await app.listen(0,"127.0.0.1"); return app.getUrl();}
  async function req(base, path, body, token) {
    const r = await fetch(base+path,{method:"POST",headers:{"content-type":"application/json",...(token?{authorization:"Bearer "+token}:{})},body:JSON.stringify(body)});
    return {status:r.status,body:await r.json()};
  }
  try {
    const passwordHash = await hashPassword(password);
    client = await db.user.create({data:{name:"Cliente original",email:"cliente-"+marker+"@example.test",passwordHash,role:"CUSTOMER"}});
    other = await db.user.create({data:{name:"Otro cliente",email:"otro-"+marker+"@example.test",passwordHash,role:"CUSTOMER"}});
    admin = await db.user.create({data:{name:"Dueño",email:"dueno-"+marker+"@example.test",passwordHash,role:"ADMIN"}});
    const auth = await listen(await authApp({logger:false}));
    const gateway = await listen(await gatewayApp({authUrl:auth,catalogUrl:auth,commerceUrl:auth},{logger:false}));
    const login = await req(gateway,"/api/auth/customer/login",{email:client.email,password});
    const login2 = await req(gateway,"/api/auth/customer/login",{email:client.email,password});
    const owner = await req(gateway,"/api/auth/admin/login",{email:admin.email,password});
    assert.equal(login.status,200); assert.equal(login2.status,200); assert.equal(owner.status,200);
    const token=login.body.token, token2=login2.body.token;
    assert.equal((await req(auth,"/api/auth/customer/profile",{name:"Sin sesión"})).status,401);
    assert.equal((await req(gateway,"/api/auth/customer/profile",{name:"Inválido"},owner.body.token)).status,401);
    assert.equal((await req(gateway,"/api/auth/customer/profile",{name:"  "},token)).status,400);
    assert.equal((await req(gateway,"/api/auth/customer/profile",{name:"Nombre",id:other.id},token)).status,400);
    assert.equal((await req(gateway,"/api/auth/customer/profile",{name:"  Nombre actualizado  "},token)).status,200);
    assert.equal((await db.user.findUniqueOrThrow({where:{id:client.id}})).name,"Nombre actualizado");
    assert.equal((await db.user.findUniqueOrThrow({where:{id:other.id}})).name,"Otro cliente");
    assert.equal((await req(gateway,"/api/auth/customer/password",{currentPassword:"incorrecta",newPassword},token)).status,400);
    assert.equal((await req(gateway,"/api/auth/customer/password",{currentPassword:password,newPassword:"corta"},token)).status,400);
    assert.equal((await req(gateway,"/api/auth/customer/password",{currentPassword:password,newPassword:password},token)).status,400);
    assert.equal((await req(gateway,"/api/auth/customer/password",{currentPassword:password,newPassword},token)).status,200);
    assert.equal(await db.customerSession.count({where:{userId:client.id}}),0);
    assert.equal((await req(gateway,"/api/auth/customer/profile",{name:"Sesión antigua"},token2)).status,401);
    assert.equal((await req(gateway,"/api/auth/customer/login",{email:client.email,password})).status,401);
    const next=await req(gateway,"/api/auth/customer/login",{email:client.email,password:newPassword});
    assert.equal(next.status,200);
    await db.user.update({where:{id:client.id},data:{isActive:false}});
    assert.equal((await req(gateway,"/api/auth/customer/profile",{name:"Bloqueado"},next.body.token)).status,401);
    assert.equal((await req(gateway,"/api/auth/customer/password",{currentPassword:newPassword,newPassword:password},next.body.token)).status,401);
  } finally {
    const ids=[client?.id,other?.id,admin?.id].filter(Boolean);
    if(ids.length) await db.user.deleteMany({where:{id:{in:ids}}});
    for(const app of apps.reverse()) await app.close();
    await db.$disconnect();
  }
});
