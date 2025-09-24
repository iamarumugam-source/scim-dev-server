import { supabase } from '../db';

const TABLE_NAME = 'scim_intercept'


export class InterceptionService {

    public async getInterceptionStatus(userId: string) {
        if(userId) throw new Error("User Id is required")

        const {data, error} = await supabase.from(TABLE_NAME).select('userId,startIndex,payload').eq("userId", userId)

        if(error) {
            throw new Error('Error fetching interception status')
        }

        return data

    }

}