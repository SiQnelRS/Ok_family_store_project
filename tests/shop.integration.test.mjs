import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createDatabaseClient} from "../packages/database/dist/index.js";
import {hashPassword} from "../packages/service-kit/dist/index.js";
import {createApp as authApp} from "../apps/auth-service/dist/app.js";
import {createApp as catalogApp} from "../apps/catalog-service/dist/app.js";
import {createApp as commerceApp} from "../apps/commerce-service/dist/app.js";
import {createApp as gatewayApp} from "../apps/api-gateway/dist/app.js";

test("carrito, direcciones y cobertura conservan propiedad y datos actuales", async () => {
  const db=createDatabaseClient(), apps=[], marker=randomUUID(), password="Clave temporal "+marker;
  const oldAuth=process.env.AUTH_SERVICE_URL, oldCatalog=process.env.CATALOG_SERVICE_URL, oldRates=process.env.LOCAL_DELIVERY_RATES_JSON;
  let first, second, admin, product, addressId;
  async function listen(app){apps.push(app); await app.listen(0,"127.0.0.1"); return app.getUrl();}
  async function request(base,path,method="GET",body,token){const r=await fetch(base+path,{method,headers:{"content-type":"application/json",...(token?{authorization:"Bearer "+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
  const address={label:"Casa",recipientName:"Cliente Ejemplo",phone:"6181234567",street:"Calle uno",number:"123",neighborhood:"Centro",postalCode:"34000",city:"Durango",state:"Durango",references:"Puerta azul"};
  try {
    const passwordHash=await hashPassword(password);
    first=await db.user.create({data:{name:"Cliente uno",email:"uno-"+marker+"@example.test",passwordHash}});
    admin=await db.user.create({data:{role:"ADMIN",name:"Operador de prueba",email:"admin-"+marker+"@example.test",passwordHash}});
    second=await db.user.create({data:{name:"Cliente dos",email:"dos-"+marker+"@example.test",passwordHash}});
    product=await db.product.create({data:{slug:"temporal-"+marker,name:"Lote temporal",description:"Solo para prueba",priceInCents:95000,category:"Prueba",type:"LOTE",piecesPerUnit:8,availableQuantity:2,published:true}});
    const auth=await listen(await authApp({logger:false})); process.env.AUTH_SERVICE_URL=auth;
    const catalog=await listen(await catalogApp(undefined,{logger:false})); process.env.CATALOG_SERVICE_URL=catalog;
    const commerce=await listen(await commerceApp({logger:false}));
    const gateway=await listen(await gatewayApp({authUrl:auth,catalogUrl:catalog,commerceUrl:commerce},{logger:false}));
    const a=await request(gateway,"/api/auth/customer/login","POST",{email:first.email,password});
    const b=await request(gateway,"/api/auth/customer/login","POST",{email:second.email,password});
    assert.equal(a.status,200); assert.equal(b.status,200); const token=a.body.token, other=b.body.token;
    assert.equal((await request(commerce,"/api/shop/cart")).status,401);
    assert.equal((await request(gateway,"/api/shop/cart")).status,401);
    assert.equal((await request(gateway,"/api/shop/cart","POST",{slug:product.slug,quantity:1,add:true},token)).status,201);
    assert.equal((await request(gateway,"/api/shop/cart","POST",{slug:product.slug,quantity:1,add:true},token)).status,201);
    let cart=await request(gateway,"/api/shop/cart","GET",undefined,token);
    assert.equal(cart.status,200); assert.equal(cart.body.subtotalInCents,190000); assert.equal(cart.body.items[0].product.piecesPerUnit,8);
    assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).availableQuantity,2);
    assert.equal((await request(gateway,"/api/shop/cart","GET",undefined,other)).body.items.length,0);
    assert.equal((await request(gateway,"/api/shop/cart","POST",{slug:product.slug,quantity:3},token)).status,409);
    await db.product.update({where:{id:product.id},data:{priceInCents:99000,availableQuantity:1}});
    cart=await request(gateway,"/api/shop/cart","GET",undefined,token);
    assert.equal(cart.body.subtotalInCents,198000); assert.equal(cart.body.items[0].available,false);
    assert.equal((await request(gateway,"/api/shop/cart","POST",{slug:product.slug,quantity:1},token)).status,201);
    assert.equal((await request(gateway,"/api/shop/addresses","POST",{...address,postalCode:"123"},token)).status,400);
    const created=await request(gateway,"/api/shop/addresses","POST",address,token);
    assert.equal(created.status,201); addressId=created.body.id;
    assert.equal((await request(gateway,"/api/shop/addresses","GET",undefined,other)).body.length,0);
    assert.equal((await request(gateway,"/api/shop/addresses/"+addressId,"PATCH",address,other)).status,404);
    assert.equal((await request(gateway,"/api/shop/addresses/"+addressId,"DELETE",undefined,other)).status,404);
    delete process.env.LOCAL_DELIVERY_RATES_JSON;
    assert.equal((await request(gateway,"/api/shop/addresses/"+addressId+"/coverage","GET",undefined,token)).body.status,"not_configured");
    process.env.LOCAL_DELIVERY_RATES_JSON=JSON.stringify({"34000":8000,"34100":0});
    let coverage=await request(gateway,"/api/shop/addresses/"+addressId+"/coverage","GET",undefined,token);
    assert.deepEqual(coverage.body,{status:"available",priceInCents:8000,currency:"MXN"});
    const quote=await request(gateway,"/api/shop/addresses/"+addressId+"/quote","GET",undefined,token);
    assert.equal(quote.body.totalInCents,107000);
    assert.equal(quote.body.shippingInCents,8000);
    const checkout = {method:"delivery",addressId,key:randomUUID(),version:quote.body.version,totalInCents:quote.body.totalInCents};
    const order = await request(gateway,"/api/shop/orders","POST",checkout,token);
    assert.equal(order.status,201,JSON.stringify(order.body));
    const orderPath = "/api/shop/orders/"+order.body.orderId+"/cancel";
    assert.equal((await request(gateway,orderPath,"POST",{},other)).status,404);
    const history = await request(gateway,"/api/shop/orders","GET",undefined,token);
    assert.equal(history.body[0].shippingAddressSnapshot.street,address.street);
    assert.equal(history.body[0].totalInCents,107000);
    const adminLogin = await request(gateway, "/api/auth/admin/login", "POST", {email:admin.email,password});
    assert.equal(adminLogin.status,200);
    const adminToken = adminLogin.body.token;
    const adminPath = "/api/admin/orders/" + order.body.orderId;
    const change = (path,previous,next,access=adminToken) => request(gateway,path,"PATCH",{previous,next},access);
    assert.equal((await request(gateway,"/api/admin/orders")).status,401);
    assert.ok([401,403].includes((await change(adminPath,"PENDIENTE_PAGO","CANCELADO",token)).status));
    const queue = await request(gateway,"/api/admin/orders?status=PENDIENTE_PAGO","GET",undefined,adminToken);
    assert.equal(queue.status,200);
    assert.ok(queue.body.items.some(row=>row.id===order.body.orderId && row.customer.name===first.name));
    assert.equal((await change(adminPath,"PENDIENTE_PAGO","PAGADO")).status,409);
    assert.equal((await change(adminPath,"PENDIENTE_PAGO","CANCELADO")).status,200);
    assert.equal(await db.orderOperation.count({where:{orderId:order.body.orderId,actorId:admin.id}}),1);
    for (const method of ["pickup","delivery"]) {
      const paid = await db.order.create({data:{userId:first.id,status:"PAGADO",shippingAddressSnapshot:{method},subtotalInCents:100,shippingInCents:0,totalInCents:100}});
      const path = "/api/admin/orders/"+paid.id;
      assert.equal((await change(path,"PAGADO","ENTREGADO")).status,409);
      assert.equal((await change(path,"PAGADO","PREPARANDO")).status,200);
      assert.equal((await change(path,"PAGADO","PREPARANDO")).status,409);
      assert.equal((await change(path,"PREPARANDO","LISTO_PARA_ENVIO")).status,200);
      if (method === "pickup") {
        assert.equal((await change(path,"LISTO_PARA_ENVIO","ENVIADO")).status,409);
        assert.equal((await change(path,"LISTO_PARA_ENVIO","ENTREGADO")).status,200);
      } else {
        assert.equal((await change(path,"LISTO_PARA_ENVIO","ENTREGADO")).status,409);
        assert.equal((await change(path,"LISTO_PARA_ENVIO","ENVIADO")).status,200);
        assert.equal((await change(path,"ENVIADO","ENTREGADO")).status,200);
      }
    }
    assert.equal((await request(gateway,orderPath,"POST",{},token)).status,201);
    assert.equal((await request(gateway,"/api/shop/cart","POST",{slug:product.slug,quantity:1},token)).status,201);
    assert.equal((await request(gateway,"/api/shop/addresses/"+addressId+"/quote","GET",undefined,other)).status,404);
    assert.equal((await request(gateway,"/api/shop/addresses/"+addressId+"/coverage","GET",undefined,other)).status,404);
    assert.equal((await request(gateway,"/api/shop/addresses/"+addressId,"PATCH",{...address,postalCode:"35000"},token)).status,200);
    assert.equal((await request(gateway,"/api/shop/addresses/"+addressId+"/coverage","GET",undefined,token)).body.status,"unavailable");
    await db.product.update({where:{id:product.id},data:{published:false}});
    cart=await request(gateway,"/api/shop/cart","GET",undefined,token);
    assert.equal(cart.body.items[0].product,null); assert.equal(cart.body.complete,false);
    assert.equal((await request(gateway,"/api/shop/cart/"+product.slug,"DELETE",undefined,token)).status,200);
    assert.equal((await request(gateway,"/api/shop/addresses/"+addressId,"DELETE",undefined,token)).status,200);
  } finally {
    if(first || second){const ids=[first?.id,second?.id,admin?.id].filter(Boolean); await db.reservation.deleteMany({where:{userId:{in:ids}}}); await db.orderItem.deleteMany({where:{order:{userId:{in:ids}}}}); await db.order.deleteMany({where:{userId:{in:ids}}}); await db.cartItem.deleteMany({where:{userId:{in:ids}}}); await db.address.deleteMany({where:{userId:{in:ids}}}); await db.user.deleteMany({where:{id:{in:ids}}});}
    if(product) await db.product.deleteMany({where:{id:product.id}});
    for(const app of apps.reverse()) await app.close();
    await db.$disconnect();
    for(const [key,value] of Object.entries({AUTH_SERVICE_URL:oldAuth,CATALOG_SERVICE_URL:oldCatalog,LOCAL_DELIVERY_RATES_JSON:oldRates})) {if(value===undefined) delete process.env[key]; else process.env[key]=value;}
  }
});
