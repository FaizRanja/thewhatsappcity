class apifeatucher{
    constructor(query,querystr){
        this.query=query;
        this.querystr=querystr
    }

Search(){
    const keyword=this.querystr.keyword?{
        name:{
            $regex:this.querystr.keyword,
            $options:"i",
        },
    
    }:{}
    this.query=this.query.find({...keyword})
    return this
}
filter(){
    const querycopy={...this.querystr}
//    Removing some field for category
    const removesomefield=["keyword","page","limit"]
    removesomefield.forEach((key)=>delete querycopy[key])
//    For pricr and rating
let querystr=JSON.stringify(querycopy);
querystr=querystr.replace(/\b(gt|gte|lt|lte)\b/g,(key)=>`$${key}`)

   this.query=this.query.find(JSON.parse(querystr))
   return this
}
}

module.exports=  apifeatucher