import React,{ useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faMinus, faPlay, faPlus, faRedo , faTrash } from '@fortawesome/free-solid-svg-icons'
import useGetResponse from '../../customHooks/useGetResponse'
import ModalCustom from '../Modal/Modal'
import Execute from './components/Execute'
import styles from './Response.module.scss'
import Confirm from '../Confirm/Confirm'
import {getModel, tableEnum} from '../../models'
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism.css';

export default function Response({ prompt, removeResponse, onLoadComplete , collection , setCollection, responseId ,lang="js" }) {
    const [numDots, setNumDots] = useState(1)
    const [modal , setModal] = useState(null)
    const [showPrompt , setShowPrompt] = useState(null);
    const countRetry = useRef(0)
    const [renderer , setRenderer] = useState(false);
    const {ask, data, error, isLoading:loading} = useGetResponse()
    const [response, setResponse] = useState(null)
    const execute = useRef(null);
    const wrapperRef = useRef(null);
    const [added , setAdded ] = useState(false);
    const keyValueDB = useRef(getModel(tableEnum.RESPONSES))
    const codeRef = useRef(null);
    const getResponse= async (prompt)=>{
        const db = keyValueDB.current;
        try{
            let res = await db.get(prompt);
            if(res)
                return res;

            res=await new Promise((resolve, reject)=>{
                ask(prompt,{
                    onError:()=>{
                        reject();
                    },
                    onSuccess:(data)=>{
                        db.add(prompt, data)
                            .then(()=>resolve(data) )
                            .catch(()=>reject());
                    }
                })
            })
            return res;

        } catch(e) {
            console.error(e.message);
            return null
        }

    }
    useEffect(()=>{
        if(data){
            setResponse(data)
        }
    },[data])

    useEffect(()=>{
        if(prompt){
            getResponse(prompt)
                .then(res=>{setResponse(res);onLoadComplete();})
                .catch(err=>console.log("unable to create response"))
        }
    },[])

    useEffect(()=>{
        if(!loading ){
            if(response?.name)
                onLoadComplete(response?.name ,responseId)
            return
        }
        const interval = setInterval(()=>{
            setNumDots(numDots=>numDots===5?1:numDots+1)
        }, 300)
        return ()=>clearInterval(interval)
    },[loading])

    useLayoutEffect(()=>{
        if(!response){
            execute.current=null
            return
        }

        try{
            window[response?.name]=null
            eval(`${response?.function_def}`)
            execute.current=(window[response?.name])
            setRenderer(prev=>!prev)
            codeRef.current.innerHTML = highlight(response?.function_def, languages.js, 'js');
            countRetry.current=0
        } catch(e){
            if(countRetry.current<8){
                ask(prompt)
                countRetry.current++
            }
        }
    },[response])
    
    function handleExecution(){
        setModal(true)
    }

    function handleChange(){
        if(!added)
            setCollection([...collection,[response?.name ?? prompt, response?.function_def, responseId]])
        else {
            setCollection(collection.filter(([func_name])=>{
                return func_name !== response?.name
            }))
        }
        setAdded(!added)
    }

    function handleEffectMounseIn(){
        if(wrapperRef.current)
            wrapperRef.current.style.opacity=1;
    }   
    function handleEffectMounseOut(){
        if(wrapperRef.current)
            wrapperRef.current.style.opacity=0;
    }

    function handleDelete(){
        setShowPrompt({
            message:"Delete function",
            onOk: ()=> {
                removeResponse();
                setAdded(false);
            },
            onCancel: ()=>null
        })
        
    }
    return (
        <React.Fragment>
            <div className={styles.response}
                onMouseEnter={handleEffectMounseIn}
                onMouseLeave={handleEffectMounseOut}>
                {
                    loading?
                    <div className={styles.loading}>
                        {
                            ".".repeat(numDots)
                        }
                    </div>
                    :
                    <pre className={`${styles.response_content} ${error?styles.error:""}`} >
                        <div className={styles.title}>
                            <span className={styles.lang}>{lang} </span> 
                            <span className={styles.function_name}>{response?.name}</span>
                        </div>
                        <hr/>
                        <div className={styles.executeWrapper} ref={wrapperRef} >
                            <FontAwesomeIcon icon={faCopy} title="copy" onClick={
                                ()=>navigator.clipboard.writeText(response?.function_def)
                            }/>

                            <FontAwesomeIcon icon={faRedo} title={"retry"} onClick={()=>{ countRetry.current=0 ;ask(prompt) }} className={styles.retry}/>
                            {
                                execute.current?
                                        <FontAwesomeIcon icon={faPlay} onClick={handleExecution} className={styles.execute} title={'execute'}/>
                                :
                                null
                            }
                            {
                                execute.current &&
                                (added?
                                <FontAwesomeIcon icon={faMinus} title={"remove"} onClick={handleChange}/>
                                :
                                <FontAwesomeIcon icon={faPlus} title={"select"} onClick={handleChange}/>
                                )
                            }
                            <FontAwesomeIcon icon={faTrash} title = {"delete"} onClick={handleDelete}/>
                        </div>
                        <span className={styles.definition_body} ref={codeRef}>
                            {
                                error&& "unable to create function "
                            }
                        </span>
                    </pre>
                }
            </div>
            <ModalCustom 
                modal = {modal} 
                setModal={setModal} 
                title={
                    <span style={{color: 'red',fontWeight: 'bold'}}>{response?.name?.split("_")?.join(" ")}</span>
                }
            >
                <Execute func={execute.current} params={response?.parameter_names??[]}/>
            </ModalCustom>
            <Confirm showPrompt={showPrompt} setShowPrompt={setShowPrompt}/>
        </React.Fragment>
    )
}